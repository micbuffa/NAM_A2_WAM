// Studio and Recording sections of the global Settings dialog (opened from the
// navigation). Existing nodes/IDs and their event handlers are preserved.
export function registerStudioSettings({settings, projectPanel, recordPanel}) {
  settings.addSection({id:'studio', label:'Studio', icon:'sliders', order:3, element:projectPanel});
  settings.addSection({id:'recording', label:'Recording', icon:'microphone', order:4, element:recordPanel});
}
