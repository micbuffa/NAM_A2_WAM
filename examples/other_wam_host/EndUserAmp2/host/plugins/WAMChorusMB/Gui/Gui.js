import '../utils/webaudio-controls.js'

      const getBaseURL = () => {
        const base = new URL('.', import.meta.url);
        return `${base}`;
      };
      export default class ChorusGui extends HTMLElement {
              constructor(plug) {
                 
        super();
            this._plug = plug;
            this._plug.gui = this;
        console.log(this._plug);
          
        this._root = this.attachShadow({ mode: 'open' });
        this.style.display = "inline-flex";
        
        this._root.innerHTML = `<style>.my-pedal {animation:none 0s ease 0s 1 normal none running;appearance:none;background:linear-gradient(to top, rgba(190, 30, 30, 0.96), rgba(144, 54, 186, 0.96)) repeat scroll 0% 0% / auto padding-box border-box, rgba(0, 0, 0, 0) url("https://mainline.i3s.unice.fr/PedalEditor/Back-End/functional-pedals/commonAssets/img/background/psyche9.jpg") repeat scroll 0% 0% / 100% 100% padding-box border-box;border:0.909091px solid rgb(73, 73, 73);bottom:0px;clear:none;clip:auto;color:rgb(33, 37, 41);columns:auto auto;contain:none;container:none;content:normal;cursor:auto;cx:0px;cy:0px;d:none;direction:ltr;display:inline-block;fill:rgb(0, 0, 0);filter:none;flex:0 1 auto;float:none;font:16px / 24px -apple-system, "system-ui", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";gap:normal;grid:none / none / none / row / auto / auto;height:323.885px;hyphens:manual;inset:0px;isolation:auto;left:0px;margin:2px;marker:none;mask:none;offset:none 0px auto 0deg;opacity:0.89;order:0;orphans:2;outline:rgb(33, 37, 41) none 0px;overflow:visible;overlay:none;padding:1px;page:auto;perspective:none;position:unset;quotes:auto;r:0px;resize:none;right:0px;rotate:none;rx:auto;ry:auto;scale:none;speak:normal;stroke:none;top:0px;transform:matrix(1, 0, 0, 1, 143.647, 35.0213);transition:all;translate:none;visibility:visible;widows:2;width:212.727px;x:0px;y:0px;zoom:1;};</style>
<div id="Chorus" class="resize-drag my-pedal gradiant-target" style="border: 1px solid rgb(73, 73, 73); text-align: center; display: inline-block; vertical-align: baseline; padding: 1px; margin: 2px; box-sizing: border-box; background: linear-gradient(to top, rgba(190, 30, 30, 0.96), rgba(144, 54, 186, 0.96)), url(&quot;https://mainline.i3s.unice.fr/PedalEditor/Back-End/functional-pedals/commonAssets/img/background/psyche9.jpg&quot;) 0% 0% / 100% 100%; box-shadow: rgba(0, 0, 0, 0.7) 4px 5px 6px, rgba(0, 0, 0, 0.2) -2px -2px 5px 0px inset, rgba(255, 255, 255, 0.2) 3px 1px 1px 4px inset, rgba(0, 0, 0, 0.9) 1px 0px 1px 0px, rgba(0, 0, 0, 0.9) 0px 2px 1px 0px, rgba(0, 0, 0, 0.9) 1px 1px 1px 0px; border-radius: 15px; touch-action: none; width: 212.727px; position: relative; top: 0px; left: 0px; height: 323.885px; transform: translate(143.647px, 35.0213px); opacity: 0.89;" data-x="143.64700317382812" data-y="35.02128601074219"><div id="Chorus" class="resize-drag" style="border: 1px solid rgb(73, 73, 73); text-align: center; display: none; vertical-align: baseline; padding: 1px; margin: 2px; box-sizing: border-box; background-size: contain; border-radius: 15px; background-color: transparent; touch-action: none; width: 93.7322px; position: absolute; top: 32.8835px; left: 100.976px; height: 358.409px; transform: translate(-51.7365px, 0px);" data-x="-51.73651123046875" data-y="0"></div><div class="drag" style="padding: 1px; margin: 1px; text-align: center; display: inline-block; box-sizing: border-box; touch-action: none; position: absolute; top: 309.146px; left: 32.9986px; transform: translate(37.4183px, -107.259px);" data-x="37.418304443359375" data-y="-107.25852966308594"><webaudio-switch id="/Chorus/bypass" src="./img/switches/switch_1.png" sprites="100" width="75" height="41" style="touch-action: none;"><style>

.webaudioctrl-tooltip{
  display:inline-block;
  position:absolute;
  margin:0 -1000px;
  z-index: 999;
  background:#eee;
  color:#000;
  border:1px solid #666;
  border-radius:4px;
  padding:5px 10px;
  text-align:center;
  left:0; top:0;
  font-size:11px;
  opacity:0;
  visibility:hidden;
}
.webaudioctrl-tooltip:before{
  content: "";
	position: absolute;
	top: 100%;
	left: 50%;
 	margin-left: -8px;
	border: 8px solid transparent;
	border-top: 8px solid #666;
}
.webaudioctrl-tooltip:after{
  content: "";
	position: absolute;
	top: 100%;
	left: 50%;
 	margin-left: -6px;
	border: 6px solid transparent;
	border-top: 6px solid #eee;
}

webaudio-switch{
  display:inline-block;
  margin:0;
  padding:0;
  font-family: sans-serif;
  font-size: 11px;
  cursor:pointer;
}
.webaudio-switch-body{
  display:inline-block;
  margin:0;
  padding:0;
}
</style>
<div class="webaudio-switch-body" tabindex="1" touch-action="none" style="background-image: url(&quot;./img/switches/switch_1.png&quot;); background-size: 100% 200%; width: 75px; height: 41px; outline: none; background-position: 0px -100%;"><div class="webaudioctrl-tooltip" style="transition: opacity 0.1s, visibility 0.1s; opacity: 0; visibility: hidden;"></div></div>
</webaudio-switch></div><div class="drag" style="padding: 1px; margin: 1px; text-align: center; display: inline-block; box-sizing: border-box; touch-action: none; position: absolute; top: 68.777px; left: 104.874px; width: 52px; height: 78.6648px; transform: translate(-71.804px, -43.0469px);" data-x="-71.80397033691406" data-y="-43.04688262939453"><webaudio-knob id="/Chorus/chorus/delay" src="./img/knobs/Carbon.png" sprites="100" min="0" max="0.2" step="0.01" width="52" height="52" style="touch-action: none; display: block;"><style>

.webaudioctrl-tooltip{
  display:inline-block;
  position:absolute;
  margin:0 -1000px;
  z-index: 999;
  background:#eee;
  color:#000;
  border:1px solid #666;
  border-radius:4px;
  padding:5px 10px;
  text-align:center;
  left:0; top:0;
  font-size:11px;
  opacity:0;
  visibility:hidden;
}
.webaudioctrl-tooltip:before{
  content: "";
	position: absolute;
	top: 100%;
	left: 50%;
 	margin-left: -8px;
	border: 8px solid transparent;
	border-top: 8px solid #666;
}
.webaudioctrl-tooltip:after{
  content: "";
	position: absolute;
	top: 100%;
	left: 50%;
 	margin-left: -6px;
	border: 6px solid transparent;
	border-top: 6px solid #eee;
}

webaudio-knob{
  display:inline-block;
  position:relative;
  margin:0;
  padding:0;
  cursor:pointer;
  font-family: sans-serif;
  font-size: 11px;
}
.webaudio-knob-body{
  display:inline-block;
  position:relative;
  z-index:1;
  margin:0;
  padding:0;
}
</style>
<div class="webaudio-knob-body" tabindex="1" touch-action="none" style="background-image: url(&quot;./img/knobs/Carbon.png&quot;); outline: none; width: 52px; height: 52px; background-position: 0px 0px; background-size: 52px 5252px; transform: rotate(0deg);"></div><div class="webaudioctrl-tooltip" style="display: inline-block; width: auto; height: auto; transition: opacity 0.1s, visibility 0.1s; opacity: 0; visibility: hidden; left: 1003.39px; top: -36.3168px;">0.00</div>
</webaudio-knob></div><div class="drag" style="padding: 1px; margin: 1px; text-align: center; display: inline-block; box-sizing: border-box; touch-action: none; position: absolute; top: 149.43px; left: 104.874px; width: 52px; height: 78.6648px; transform: translate(15.8736px, -126.594px);" data-x="15.873626708984375" data-y="-126.59444046020508"><webaudio-knob id="/Chorus/chorus/depth" src="./img/knobs/Carbon.png" sprites="100" min="0" max="1" step="0.01" width="52" height="52" style="touch-action: none; display: block;"><style>

.webaudioctrl-tooltip{
  display:inline-block;
  position:absolute;
  margin:0 -1000px;
  z-index: 999;
  background:#eee;
  color:#000;
  border:1px solid #666;
  border-radius:4px;
  padding:5px 10px;
  text-align:center;
  left:0; top:0;
  font-size:11px;
  opacity:0;
  visibility:hidden;
}
.webaudioctrl-tooltip:before{
  content: "";
	position: absolute;
	top: 100%;
	left: 50%;
 	margin-left: -8px;
	border: 8px solid transparent;
	border-top: 8px solid #666;
}
.webaudioctrl-tooltip:after{
  content: "";
	position: absolute;
	top: 100%;
	left: 50%;
 	margin-left: -6px;
	border: 6px solid transparent;
	border-top: 6px solid #eee;
}

webaudio-knob{
  display:inline-block;
  position:relative;
  margin:0;
  padding:0;
  cursor:pointer;
  font-family: sans-serif;
  font-size: 11px;
}
.webaudio-knob-body{
  display:inline-block;
  position:relative;
  z-index:1;
  margin:0;
  padding:0;
}
</style>
<div class="webaudio-knob-body" tabindex="1" touch-action="none" style="background-image: url(&quot;./img/knobs/Carbon.png&quot;); background-size: 52px 5252px; outline: none; width: 52px; height: 52px; background-position: 0px -5200px; transform: rotate(0deg);"></div><div class="webaudioctrl-tooltip" style="display: inline-block; width: auto; height: auto; transition: opacity 0.1s, visibility 0.1s; opacity: 0; visibility: hidden; left: 1003.39px; top: -36.3168px;">1.00</div>
</webaudio-knob></div><div class="drag" style="padding: 1px; margin: 1px; text-align: center; display: inline-block; box-sizing: border-box; touch-action: none; position: absolute; top: 230.084px; left: 104.874px; width: 52px; height: 78.6648px; transform: translate(-71.4062px, -124.453px);" data-x="-71.40625" data-y="-124.453125"><webaudio-knob id="/Chorus/chorus/freq" src="./img/knobs/Carbon.png" sprites="100" min="0" max="10" step="0.01" width="52" height="52" style="touch-action: none; display: block;"><style>

.webaudioctrl-tooltip{
  display:inline-block;
  position:absolute;
  margin:0 -1000px;
  z-index: 999;
  background:#eee;
  color:#000;
  border:1px solid #666;
  border-radius:4px;
  padding:5px 10px;
  text-align:center;
  left:0; top:0;
  font-size:11px;
  opacity:0;
  visibility:hidden;
}
.webaudioctrl-tooltip:before{
  content: "";
	position: absolute;
	top: 100%;
	left: 50%;
 	margin-left: -8px;
	border: 8px solid transparent;
	border-top: 8px solid #666;
}
.webaudioctrl-tooltip:after{
  content: "";
	position: absolute;
	top: 100%;
	left: 50%;
 	margin-left: -6px;
	border: 6px solid transparent;
	border-top: 6px solid #eee;
}

webaudio-knob{
  display:inline-block;
  position:relative;
  margin:0;
  padding:0;
  cursor:pointer;
  font-family: sans-serif;
  font-size: 11px;
}
.webaudio-knob-body{
  display:inline-block;
  position:relative;
  z-index:1;
  margin:0;
  padding:0;
}
</style>
<div class="webaudio-knob-body" tabindex="1" touch-action="none" style="background-image: url(&quot;./img/knobs/Carbon.png&quot;); background-size: 52px 5252px; outline: none; width: 52px; height: 52px; background-position: 0px -2080px; transform: rotate(0deg);"></div><div class="webaudioctrl-tooltip" style="display: inline-block; width: auto; height: auto; transition: opacity 0.1s, visibility 0.1s; opacity: 0; visibility: hidden; left: 1003.39px; top: -36.3168px;">4.06</div>
</webaudio-knob></div><div class="drag" style="padding: 1px; margin: 1px; text-align: center; display: inline-block; box-sizing: border-box; touch-action: none; position: absolute; top: 310.737px; left: 104.874px; width: 52px; height: 78.6648px; transform: translate(16.1506px, -205.593px);" data-x="16.15057373046875" data-y="-205.593017578125"><webaudio-knob id="/Chorus/chorus/level" src="./img/knobs/Carbon.png" sprites="100" min="0" max="1" step="0.01" width="52" height="52" style="touch-action: none; display: block;"><style>

.webaudioctrl-tooltip{
  display:inline-block;
  position:absolute;
  margin:0 -1000px;
  z-index: 999;
  background:#eee;
  color:#000;
  border:1px solid #666;
  border-radius:4px;
  padding:5px 10px;
  text-align:center;
  left:0; top:0;
  font-size:11px;
  opacity:0;
  visibility:hidden;
}
.webaudioctrl-tooltip:before{
  content: "";
	position: absolute;
	top: 100%;
	left: 50%;
 	margin-left: -8px;
	border: 8px solid transparent;
	border-top: 8px solid #666;
}
.webaudioctrl-tooltip:after{
  content: "";
	position: absolute;
	top: 100%;
	left: 50%;
 	margin-left: -6px;
	border: 6px solid transparent;
	border-top: 6px solid #eee;
}

webaudio-knob{
  display:inline-block;
  position:relative;
  margin:0;
  padding:0;
  cursor:pointer;
  font-family: sans-serif;
  font-size: 11px;
}
.webaudio-knob-body{
  display:inline-block;
  position:relative;
  z-index:1;
  margin:0;
  padding:0;
}
</style>
<div class="webaudio-knob-body" tabindex="1" touch-action="none" style="background-image: url(&quot;./img/knobs/Carbon.png&quot;); background-size: 52px 5252px; outline: none; width: 52px; height: 52px; background-position: 0px -5200px; transform: rotate(0deg);"></div><div class="webaudioctrl-tooltip" style="display: inline-block; width: auto; height: auto; transition: opacity 0.1s, visibility 0.1s; opacity: 0; visibility: hidden; left: 1003.39px; top: -36.3168px;">1.00</div>
</webaudio-knob></div><label for="Chorus" style="display: block; touch-action: none; position: absolute; z-index: 1; width: 190px; left: 1.89488px; top: 4.39346px; transform: translate(10.7469px, 255.5px); border: none; font-family: &quot;Fontdiner Swanky&quot;; font-size: 41px; color: rgb(225, 255, 0); -webkit-text-stroke: 1px rgb(26, 25, 25);" class="drag target-style-label" contenteditable="false" data-x="10.746929373610158" data-y="255.49995061384453" font="Fontdiner Swanky">Chorus</label><label for="chorus" style="display: none; touch-action: none; position: absolute; z-index: 1; width: 50px; left: 105.773px; top: 40.1818px; border: none; font-family: &quot;Fontdiner Swanky&quot;; color: rgb(225, 255, 0);" class="drag" contenteditable="false" font="Fontdiner Swanky">chorus</label><label for="bypass" style="text-align: center; display: none; touch-action: none; position: absolute; z-index: 1; width: 50px; left: 35.8864px; top: 360.8px; border: none; font-family: &quot;Fontdiner Swanky&quot;; color: rgb(225, 255, 0);" class="drag" contenteditable="false" font="Fontdiner Swanky">bypass</label><label for="delay" style="text-align: center; display: block; touch-action: none; position: absolute; z-index: 1; width: 50px; left: 107.761px; top: 118.839px; transform: translate(-74.3963px, -34.7976px); border: none; font-family: &quot;Fontdiner Swanky&quot;; color: rgb(225, 255, 0);" class="drag" contenteditable="false" data-x="-74.39628601074219" data-y="-34.79759216308594" font="Fontdiner Swanky">delay</label><label for="depth" style="text-align: center; display: block; touch-action: none; position: absolute; z-index: 1; width: 60px; left: 107.761px; top: 199.493px; transform: translate(14.6839px, -117.358px); border: none; font-family: &quot;Fontdiner Swanky&quot;; color: rgb(225, 255, 0);" class="drag" contenteditable="false" data-x="14.68389892578125" data-y="-117.35794067382812" font="Fontdiner Swanky">depth</label><label for="freq" style="text-align: center; display: block; touch-action: none; position: absolute; z-index: 1; width: 50px; left: 107.761px; top: 280.146px; transform: translate(-70.5078px, -116.868px); border: none; font-family: &quot;Fontdiner Swanky&quot;; color: rgb(225, 255, 0);" class="drag" contenteditable="false" data-x="-70.5078125" data-y="-116.86787414550781" font="Fontdiner Swanky">freq</label><label for="level" style="text-align: center; display: block; touch-action: none; position: absolute; z-index: 1; width: 50px; left: 107.761px; top: 360.8px; transform: translate(15.8416px, -198.271px); border: none; font-family: &quot;Fontdiner Swanky&quot;; color: rgb(225, 255, 0);" class="drag" contenteditable="false" data-x="15.841644287109375" data-y="-198.2705841064453" font="Fontdiner Swanky">level</label></div>`;
  
        this.isOn;
            this.state = new Object();
            this.setKnobs();
            this.setSliders();
            this.setSwitches();
            //this.setSwitchListener();
            this.setInactive();
            // Change #pedal to .my-pedal for use the new builder
            this._root.querySelector('.my-pedal').style.transform = 'none';
            //this._root.querySelector("#test").style.fontFamily = window.getComputedStyle(this._root.querySelector("#test")).getPropertyValue('font-family');
  
            // Compute base URI of this main.html file. This is needed in order
            // to fix all relative paths in CSS, as they are relative to
            // the main document, not the plugin's main.html
            this.basePath = getBaseURL();
            console.log("basePath = " + this.basePath)
  
            // Fix relative path in WebAudio Controls elements
            this.fixRelativeImagePathsInCSS();
  
            // optionnal : set image background using a relative URI (relative
            // to this file)
        //this.setImageBackground("/img/BigMuffBackground.png");
          
        // Monitor param changes in order to update the gui
        window.requestAnimationFrame(this.handleAnimationFrame);
      
              }
          
              fixRelativeImagePathsInCSS() {
                 
      // change webaudiocontrols relative paths for spritesheets to absolute
          let webaudioControls = this._root.querySelectorAll(
              'webaudio-knob, webaudio-slider, webaudio-switch, img'
          );
          webaudioControls.forEach((e) => {
              let currentImagePath = e.getAttribute('src');
              if (currentImagePath !== undefined) {
                  //console.log("Got wc src as " + e.getAttribute("src"));
                  let imagePath = e.getAttribute('src');
                  e.setAttribute('src', this.basePath + '/' + imagePath);
                  //console.log("After fix : wc src as " + e.getAttribute("src"));
              }
          });
  
          let sliders = this._root.querySelectorAll('webaudio-slider');
          sliders.forEach((e) => {
              let currentImagePath = e.getAttribute('knobsrc');
              if (currentImagePath !== undefined) {
                  let imagePath = e.getAttribute('knobsrc');
                  e.setAttribute('knobsrc', this.basePath + '/' + imagePath);
              }
          });

          // BMT Get all fonts
          // Need to get the attr font
          let usedFonts = "";
          let fonts = this._root.querySelectorAll('label[font]');
          fonts.forEach((e) => {
              if(!usedFonts.includes(e.getAttribute("font"))) usedFonts += "family=" + e.getAttribute("font") + "&";
          });
          let link = document.createElement('link');
          link.rel = "stylesheet";
          if(usedFonts.slice(0, -1)) link.href = "https://fonts.googleapis.com/css2?"+usedFonts.slice(0, -1)+"&display=swap";
          document.querySelector('head').appendChild(link);
          
          // BMT Adapt for background-image
          let divs = this._root.querySelectorAll('div');
          divs.forEach((e) => {
              if('background-image' in e.style){
                let currentImagePath = e.style.backgroundImage.slice(4, -1);
                if (currentImagePath !== undefined) {
                    let imagePath = e.style.backgroundImage.slice(5, -2);
                    if(imagePath != "") e.style.backgroundImage = 'url(' + this.basePath + '/' + imagePath + ')';
                }
              }
          });
          
              }
          
              setImageBackground() {
                 
      // check if the shadowroot host has a background image
          let mainDiv = this._root.querySelector('#main');
          mainDiv.style.backgroundImage =
              'url(' + this.basePath + '/' + imageRelativeURI + ')';
  
          //console.log("background =" + mainDiv.style.backgroundImage);
          //this._root.style.backgroundImage = "toto.png";
      
              }
          
              attributeChangedCallback() {
                 
            console.log('Custom element attributes changed.');
            this.state = JSON.parse(this.getAttribute('state'));
        let tmp = '/PingPongDelayFaust/bypass';
        
        if (this.state[tmp] == 1) {
          this._root.querySelector('#switch1').value = 0;
          this.isOn = false;
        } else if (this.state[tmp] == 0) {
          this._root.querySelector('#switch1').value = 1;
          this.isOn = true;
        }
  
        this.knobs = this._root.querySelectorAll('.knob');
        console.log(this.state);
  
        for (var i = 0; i < this.knobs.length; i++) {
          this.knobs[i].setValue(this.state[this.knobs[i].id], false);
          console.log(this.knobs[i].value);
        }
      
              }
          handleAnimationFrame = () => {
        this._root.getElementById('/Chorus/chorus/delay').value = this._plug.audioNode.getParamValue('/Chorus/chorus/delay');
        

        this._root.getElementById('/Chorus/chorus/depth').value = this._plug.audioNode.getParamValue('/Chorus/chorus/depth');
        

        this._root.getElementById('/Chorus/chorus/freq').value = this._plug.audioNode.getParamValue('/Chorus/chorus/freq');
        

        this._root.getElementById('/Chorus/chorus/level').value = this._plug.audioNode.getParamValue('/Chorus/chorus/level');
        

          this._root.getElementById('/Chorus/bypass').value = 1 - this._plug.audioNode.getParamValue('/Chorus/bypass');
         
window.requestAnimationFrame(this.handleAnimationFrame);
         }
      
              get properties() {
                 
        this.boundingRect = {
            dataWidth: {
              type: Number,
              value: null
            },
            dataHeight: {
              type: Number,
              value: null
            }
        };
        return this.boundingRect;
      
              }
          
              static get observedAttributes() {
                 
        return ['state'];
      
              }
          
              setKnobs() {
                 this._root.getElementById("/Chorus/chorus/delay").addEventListener("input", (e) =>this._plug.audioNode.setParamValue("/Chorus/chorus/delay", e.target.value));
this._root.getElementById("/Chorus/chorus/depth").addEventListener("input", (e) =>this._plug.audioNode.setParamValue("/Chorus/chorus/depth", e.target.value));
this._root.getElementById("/Chorus/chorus/freq").addEventListener("input", (e) =>this._plug.audioNode.setParamValue("/Chorus/chorus/freq", e.target.value));
this._root.getElementById("/Chorus/chorus/level").addEventListener("input", (e) =>this._plug.audioNode.setParamValue("/Chorus/chorus/level", e.target.value));

              }
          
              setSliders() {
                 
              }
          
              setSwitches() {
                 this._root.getElementById("/Chorus/bypass").addEventListener("change", (e) =>this._plug.audioNode.setParamValue("/Chorus/bypass", 1 - e.target.value));

              }
          
              setInactive() {
                 
        let switches = this._root.querySelectorAll(".switch webaudio-switch");
  
        switches.forEach(s => {
          console.log("### SWITCH ID = " + s.id);
          this._plug.audioNode.setParamValue(s.id, 0);
        });
      
              }
          }
      try {
          customElements.define('wap-chorus', 
                                ChorusGui);
          console.log("Element defined");
      } catch(error){
          console.log(error);
          console.log("Element already defined");      
      }
      