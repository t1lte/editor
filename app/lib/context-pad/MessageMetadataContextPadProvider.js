import { is } from 'bpmn-js/lib/util/ModelUtil';

export default function MessageMetadataContextPadProvider(contextPad) {
  contextPad.registerProvider(this);
}

MessageMetadataContextPadProvider.$inject = [
  'contextPad'
];

MessageMetadataContextPadProvider.prototype.getContextPadEntries = function(element) {
  const actions = {};

  if (!is(element, 'bpmn:Message')) {
    return actions;
  }

  actions['message.metadata'] = {
    group: 'edit',
    className: 'bpmn-icon-data-object',
    title: 'Edit message metadata',
    action: {
      click: () => {
        if (window.openMetaEditor) {
          window.openMetaEditor(element);
        }
      }
    }
  };

  return actions;
};
