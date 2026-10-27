import {actionsRow, button, createDialog} from '../account/dialogs.js';
import {AUDIO_ACCEPT, nameFromFile} from './ProjectsModel.js';
const el = (tag, fields={}) => Object.assign(document.createElement(tag), fields);

// Shared by file, YouTube and Tone imports. Capture the destination explicitly;
// a later project selection cannot redirect an upload already in progress.
export function importDestinationFields({project, name='', id}) {
  const root=el('fieldset',{className:'studio-import-destination'});
  const destination=el('select',{id:`${id}-destination`});
  if(project?.owned) destination.append(el('option',{value:String(project.id),textContent:`Add to ${project.name}`}));
  destination.append(el('option',{value:'new',textContent:'New project'}));
  destination.value=project?.owned?String(project.id):'new';
  const projectName=el('input',{id:`${id}-project-name`,value:name,maxLength:120});
  const nameLabel=el('label',{textContent:'Project name'});nameLabel.append(projectName);
  const label=el('label',{textContent:'Destination project'});label.append(destination);
  const update=()=>{nameLabel.hidden=destination.value!=='new';projectName.required=!nameLabel.hidden;projectName.disabled=nameLabel.hidden;};
  destination.onchange=update;update();root.append(label,nameLabel);
  return {root,projectName,read:()=>destination.value==='new'?{name:projectName.value.trim()}
    : {projectId:project.id}};
}

export function audioImportDialog({project,name='',fileRequired=false}) {
  return new Promise(resolve=>{
    const {dialog,body,id}=createDialog({title:'Import audio into Studio',className:'studio-import-dialog'});
    const form=el('form');
    const fields=importDestinationFields({project,name,id});
    const file=el('input',{type:'file',accept:AUDIO_ACCEPT,required:fileRequired});
    if(fileRequired){
      const label=el('label',{textContent:'Audio file'});label.append(file);form.append(label);
      let automaticName=name;
      file.onchange=()=>{
        if(!file.files?.[0])return;
        const next=nameFromFile(file.files[0].name);
        if(!fields.projectName.value.trim() || fields.projectName.value===automaticName)fields.projectName.value=next;
        automaticName=next;
      };
    }
    const cancel=button('Cancel'),submit=button('Import audio',{type:'submit',primary:true});
    cancel.onclick=()=>dialog.close();
    let result=null;
    form.onsubmit=event=>{
      event.preventDefault();result={destination:fields.read(),file:fileRequired?file.files[0]:null};dialog.close();
    };
    form.append(fields.root,actionsRow(cancel,submit));body.append(form);
    dialog.addEventListener('close',()=>resolve(result),{once:true});dialog.showModal();
  });
}
