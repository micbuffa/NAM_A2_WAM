import {createDialog} from '../account/dialogs.js';

// Move the existing controls, never clone/rebind them or touch audio/transport.
export class StudioOptionsDialog {
  constructor({button,panel,title,workspaces,workspace,create=createDialog}) {
    Object.assign(this,{button,panel,title,workspaces,workspace,create});
    this.open=()=>this.show();this.leave=()=>this.dialog?.close();
    button.addEventListener('click',this.open);
    workspaces?.addEventListener('change',this.leave);workspace?.addEventListener('change',this.leave);
  }
  show() {
    if(this.dialog||this.button.disabled)return;
    const parent=this.panel.parentNode,next=this.panel.nextSibling;
    const {dialog,body}=this.create({title:this.title,className:'studio-options-dialog'});
    this.dialog=dialog;this.panel.hidden=false;body.append(this.panel);
    dialog.addEventListener('close',()=>{
      this.panel.hidden=true;parent.insertBefore(this.panel,next);this.dialog=null;
      if(this.button.isConnected&&!this.button.disabled)this.button.focus();
    },{once:true});
    dialog.showModal();
  }
  destroy(){this.dialog?.close();this.button.removeEventListener('click',this.open);this.workspaces?.removeEventListener('change',this.leave);this.workspace?.removeEventListener('change',this.leave);}
}
