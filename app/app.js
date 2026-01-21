import ChoreoModeler from 'chor-js/lib/Modeler';
import PropertiesPanelModule from 'bpmn-js-properties-panel';

import Reporter from './lib/validator/Validator.js';
import PropertiesProviderModule from './lib/properties-provider';

import xml from './diagrams/pizzaDelivery.bpmn';
import blankXml from './diagrams/newDiagram.bpmn';

import MessageMetadataPadModule from './lib/context-pad';

let lastFile;
let isValidating = false;
let isDirty = false;

// create and configure a chor-js instance
const modeler = new ChoreoModeler({
  container: '#canvas',
  propertiesPanel: {
    parent: '#properties-panel'
  },
  additionalModules: [
    PropertiesPanelModule,
    PropertiesProviderModule,
    MessageMetadataPadModule
  ],
  keyboard: {
    bindTo: document
  }
});

// display the given model (XML representation)
async function renderModel(newXml) {
  await modeler.importXML(newXml);
  isDirty = false;
}

// returns the file name of the diagram currently being displayed
function diagramName() {
  if (lastFile) {
    return lastFile.name;
  }
  return 'diagram.bpmn';
}

document.addEventListener('DOMContentLoaded', () => {

  // download diagram as XML
  const downloadLink = document.getElementById('js-download-diagram');
  downloadLink.addEventListener('click', async () => {
    const result = await modeler.saveXML({ format: true });
    downloadLink.href =
      'data:application/bpmn20-xml;charset=UTF-8,' +
      encodeURIComponent(result.xml);
    downloadLink.download = diagramName();
    isDirty = false;
  });

  // download diagram as SVG
  const downloadSvgLink = document.getElementById('js-download-svg');
  downloadSvgLink.addEventListener('click', async () => {
    const result = await modeler.saveSVG();
    downloadSvgLink.href =
      'data:image/svg+xml;charset=UTF-8,' +
      encodeURIComponent(result.svg);
    downloadSvgLink.download = diagramName() + '.svg';
  });

  // open file dialog
  document.getElementById('js-open-file').addEventListener('click', () => {
    document.getElementById('file-input').click();
  });

  // toggle side panels
  const panels = Array.from(document.getElementById('panel-toggle').children);
  panels.forEach(panel => {
    panel.addEventListener('click', () => {
      panels.forEach(other => {
        if (panel === other && !panel.classList.contains('active')) {
          panel.classList.add('active');
          document
            .getElementById(panel.dataset.togglePanel)
            .classList.remove('hidden');
        } else {
          other.classList.remove('active');
          document
            .getElementById(other.dataset.togglePanel)
            .classList.add('hidden');
        }
      });
    });
  });

  // load diagram from disk
  const loadDiagram = document.getElementById('file-input');
  loadDiagram.addEventListener('change', () => {
    const file = loadDiagram.files[0];
    if (!file) return;

    const reader = new FileReader();
    lastFile = file;

    reader.onload = async () => {
      await renderModel(reader.result);
      loadDiagram.value = null;
    };

    reader.readAsText(file);
  });

  // validation
  const reporter = new Reporter(modeler);
  const validateButton = document.getElementById('js-validate');

  validateButton.addEventListener('click', () => {
    isValidating = !isValidating;

    if (isValidating) {
      reporter.validateDiagram();
      validateButton.classList.add('selected');
    } else {
      reporter.clearAll();
      validateButton.classList.remove('selected');
    }
  });

  modeler.on('commandStack.changed', () => {
    if (isValidating) reporter.validateDiagram();
    isDirty = true;
  });

  modeler.on('import.render.complete', () => {
    if (isValidating) reporter.validateDiagram();
  });
});

// expose for debugging
window.bpmnjs = modeler;

window.addEventListener('beforeunload', e => {
  if (isDirty) {
    e.preventDefault();
    e.returnValue = '';
  }
});

/**
 * =========================
 * META DATA EDITOR
 * =========================
 */

window.openMetaEditor = function(element) {
  const modal = document.getElementById('meta-modal');
  const fieldsContainer = document.getElementById('meta-fields');
  const preview = document.getElementById('meta-preview');

  let variables = [];

  const bo = element.businessObject;

  // load existing schema
  if (bo.documentation && bo.documentation[0]) {
    try {
      const parsed = JSON.parse(bo.documentation[0].text);
      variables = Object.entries(parsed.properties || {}).map(
        ([name, def]) => ({ name, type: def.type })
      );
    } catch (e) {}
  }

  function buildSchema() {
    const properties = {};
    const required = [];

    variables.forEach(v => {
      if (!v.name) return;
      properties[v.name] = { type: v.type };
      required.push(v.name);
    });

    return { properties, required };
  }

  function updatePreview() {
    preview.textContent = JSON.stringify(buildSchema(), null, 2);
  }

  function renderFields() {
    fieldsContainer.innerHTML = '';

    variables.forEach((v, idx) => {
      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.gap = '6px';
      row.style.marginBottom = '6px';

      row.innerHTML = `
        <input placeholder="name" value="${v.name || ''}" />
        <select>
          <option value="string">string</option>
          <option value="boolean">boolean</option>
          <option value="int">int</option>
        </select>
        <button>✖</button>
      `;

      const nameInput = row.querySelector('input');
      const typeSelect = row.querySelector('select');

      typeSelect.value = v.type;

      nameInput.oninput = e => {
        v.name = e.target.value;
        updatePreview();
      };

      typeSelect.onchange = e => {
        v.type = e.target.value;
        updatePreview();
      };

      row.querySelector('button').onclick = () => {
        variables.splice(idx, 1);
        renderFields();
        updatePreview();
      };

      fieldsContainer.appendChild(row);
    });
  }

  document.getElementById('meta-add-field').onclick = () => {
    variables.push({ name: '', type: 'string' });
    renderFields();
    updatePreview();
  };

  document.getElementById('meta-cancel').onclick = () => {
    modal.classList.add('hidden');
  };

  document.getElementById('meta-save').onclick = () => {
    const modeling = window.bpmnjs.get('modeling');
    const bpmnFactory = window.bpmnjs.get('bpmnFactory');

    const documentation = bpmnFactory.create('bpmn:Documentation', {
      text: JSON.stringify(buildSchema(), null, 2)
    });

    modeling.updateProperties(element, {
      documentation: [documentation]
    });

    modal.classList.add('hidden');
  };

  renderFields();
  updatePreview();
  modal.classList.remove('hidden');
};

renderModel(xml);

