import { is } from 'bpmn-js/lib/util/ModelUtil';

/**
 * Extract variable names from condition like:
 *   is_true == false
 *   is_true=true
 */
function extractVariables(condition) {
  if (!condition) {
    return [];
  }

  const match = condition.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*(==|=)/);
  return match ? [ match[1] ] : [];
}

/**
 * Extract variables from message documentation schema
 */
function extractMessageVariables(messageBo) {
  if (!messageBo.documentation || !messageBo.documentation[0]) {
    return [];
  }

  try {
    const schema = JSON.parse(messageBo.documentation[0].text);
    return schema.properties ? Object.keys(schema.properties) : [];
  } catch (e) {
    return [];
  }
}

/**
 * Walk backwards from a gateway and collect all variables
 * defined by messages before it
 */
function collectDefinedVariablesFromPast(startNode) {
  const vars = new Set();
  const visited = new Set();

  function walk(node) {
    if (!node || visited.has(node.id)) {
      return;
    }
    visited.add(node.id);

    // If choreography task — inspect its messages
    if (is(node, 'bpmn:ChoreographyTask')) {
      const bo = node.businessObject;

      if (bo.messageFlowRef && bo.messageFlowRef.length) {
        bo.messageFlowRef.forEach(mf => {
          const message = mf.messageRef;
          if (message) {
            extractMessageVariables(message).forEach(v => vars.add(v));
          }
        });
      }
    }

    // Continue walking backwards
    if (node.incoming) {
      node.incoming.forEach(flow => walk(flow.source));
    }
  }

  walk(startNode);
  return vars;
}

export default function sequenceFlowVariableConstraint(shape, reporter) {
  // Only care about conditional sequence flows
  if (!is(shape, 'bpmn:SequenceFlow') || !shape.businessObject.name) {
    return;
  }

  const usedVars = extractVariables(shape.businessObject.name);
  if (!usedVars.length) {
    return;
  }

  const source = shape.source;

  // Conditions only make sense on gateways
  if (!is(source, 'bpmn:Gateway')) {
    return;
  }

  const definedVars = collectDefinedVariablesFromPast(source);

  usedVars.forEach(v => {
    if (!definedVars.has(v)) {
      reporter.error(
        shape,
        `Variable <b>${v}</b> is used in gateway condition but not defined by any preceding message`
      );
    }
  });
}
