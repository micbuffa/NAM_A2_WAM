import '../utils/webaudio-controls.js'

      const getBaseURL = () => {
        const base = new URL('.', import.meta.url);
        return `${base}`;
      };
      export default class VintageAmp60sGui extends HTMLElement {
              constructor(plug) {
                 
        super();
            this._plug = plug;
            this._plug.gui = this;
        console.log(this._plug);
          
        this._root = this.attachShadow({ mode: 'open' });
        this.style.display = "inline-flex";
        
        this._root.innerHTML = `<style>.my-pedal {animation:none 0s ease 0s 1 normal none running;appearance:none;background:linear-gradient(to top, rgba(255, 250, 92, 0.27), rgba(31, 229, 91, 0.27)) repeat scroll 0% 0% / auto padding-box border-box, rgba(0, 0, 0, 0) url("https://mainline.i3s.unice.fr/PedalEditor/Back-End/functional-pedals/commonAssets/img/background/psyche10.jpg") repeat scroll 0% 0% / 100% 100% padding-box border-box;border:1px dashed rgb(73, 73, 73);bottom:0px;clear:none;clip:auto;color:rgb(33, 37, 41);columns:auto auto;contain:none;container:none;content:normal;cursor:auto;cx:0px;cy:0px;d:none;direction:ltr;display:inline-block;fill:rgb(0, 0, 0);filter:none;flex:0 1 auto;float:none;font:16px / 24px -apple-system, "system-ui", "Segoe UI", Roboto, "Helvetica Neue", Arial, "Noto Sans", sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";gap:normal;grid:none / none / none / row / auto / auto;height:182.594px;hyphens:manual;inset:0px;isolation:auto;left:0px;margin:2px;marker:none;mask:none;offset:none 0px auto 0deg;opacity:1;order:0;orphans:2;outline:rgb(33, 37, 41) none 0px;overflow:visible;overlay:none;padding:1px;page:auto;perspective:none;position:unset;quotes:auto;r:0px;resize:none;right:0px;rotate:none;rx:auto;ry:auto;scale:none;speak:normal;stroke:none;top:0px;transform:matrix(1, 0, 0, 1, 0, 0);transition:all;translate:none;visibility:visible;widows:2;width:548.875px;x:0px;y:0px;zoom:1;};</style>
<div id="VintageAmp60s" class="resize-drag my-pedal target-style-container gradiant-target" style="border: 1px dashed rgb(73, 73, 73); text-align: center; display: inline-block; vertical-align: baseline; padding: 1px; margin: 2px; box-sizing: border-box; background: linear-gradient(to top, rgba(255, 250, 92, 0.27), rgba(31, 229, 91, 0.27)), url(&quot;https://mainline.i3s.unice.fr/PedalEditor/Back-End/functional-pedals/commonAssets/img/background/psyche10.jpg&quot;) 0% 0% / 100% 100%; box-shadow: rgba(0, 0, 0, 0.7) 4px 5px 6px, rgba(0, 0, 0, 0.2) -2px -2px 5px 0px inset, rgba(255, 255, 255, 0.2) 3px 1px 1px 4px inset, rgba(0, 0, 0, 0.9) 1px 0px 1px 0px, rgba(0, 0, 0, 0.9) 0px 2px 1px 0px, rgba(0, 0, 0, 0.9) 1px 1px 1px 0px; border-radius: 15px; touch-action: none; width: 548.883px; position: relative; top: 0px; left: 0px; height: 182.605px; transform: translate(0px, 0px); opacity: 1;" data-x="0" data-y="0"><div class="drag" style="padding: 1px; margin: 1px; text-align: center; display: inline-block; box-sizing: border-box; touch-action: none; position: absolute; top: 32.8821px; left: 10.4915px; width: 41.9886px; height: 78.6648px; transform: translate(141.16px, -7.57812px);" data-x="141.16015625" data-y="-7.578125"><webaudio-knob id="/VintageAmp60s/Bass" src="./img/knobs/Jambalaya.png" sprites="100" min="0" max="1" step="0.01" width="40" height="40" style="touch-action: none; display: block;"><style>

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
<div class="webaudio-knob-body" tabindex="1" touch-action="none" style="background-image: url(&quot;./img/knobs/Jambalaya.png&quot;); background-size: 40px 4040px; outline: none; width: 40px; height: 40px; background-position: 0px -3800px; transform: rotate(0deg);"></div><div class="webaudioctrl-tooltip" style="display: inline-block; width: auto; height: auto; transition: opacity 0.1s, visibility 0.1s; opacity: 0; visibility: hidden; left: 997.285px; top: -36.5px;">0.95</div>
</webaudio-knob></div><div class="drag" style="padding: 1px; margin: 1px; text-align: center; display: inline-block; box-sizing: border-box; touch-action: none; position: absolute; top: 113.536px; left: 0.889191px; transform: translate(446.043px, -81.7383px);" data-x="446.04296875" data-y="-81.73828125"><webaudio-switch id="/VintageAmp60s/Bright" src="./img/switches/Power_switch_01.png" sprites="100" width="64" height="61" style="touch-action: none;"><style>

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
<div class="webaudio-switch-body" tabindex="1" touch-action="none" style="background-image: url(&quot;./img/switches/Power_switch_01.png&quot;); background-size: 100% 200%; width: 64px; height: 61px; outline: none; background-position: 0px 0px;"><div class="webaudioctrl-tooltip" style="transition: opacity 0.1s, visibility 0.1s; opacity: 0; visibility: hidden;"></div></div>
</webaudio-switch></div><div class="drag" style="padding: 1px; margin: 1px; text-align: center; display: inline-block; box-sizing: border-box; touch-action: none; position: absolute; top: 195.78px; left: 5.40623px; width: 52.1591px; height: 78.6648px; transform: translate(73.4219px, -171.047px);" data-x="73.421875" data-y="-171.046875"><webaudio-knob id="/VintageAmp60s/Master" src="./img/knobs/Jambalaya.png" sprites="100" min="0" max="1" step="0.01" width="40" height="40" style="touch-action: none; display: block;"><style>

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
<div class="webaudio-knob-body" tabindex="1" touch-action="none" style="background-image: url(&quot;./img/knobs/Jambalaya.png&quot;); background-size: 40px 4040px; outline: none; width: 40px; height: 40px; background-position: 0px -4000px; transform: rotate(0deg);"></div><div class="webaudioctrl-tooltip" style="display: inline-block; width: auto; height: auto; transition: opacity 0.1s, visibility 0.1s; opacity: 0; visibility: hidden; left: 1003.37px; top: -36.5px;">1.00</div>
</webaudio-knob></div><div class="drag" style="padding: 1px; margin: 1px; text-align: center; display: inline-block; box-sizing: border-box; touch-action: none; position: absolute; top: 276.433px; left: 6.03835px; width: 50.8949px; height: 78.6648px; transform: translate(207.59px, -250.91px);" data-x="207.59041451459132" data-y="-250.91001951318657"><webaudio-knob id="/VintageAmp60s/Middle" src="./img/knobs/Jambalaya.png" sprites="100" min="0" max="1" step="0.01" width="40" height="40" style="touch-action: none; display: block;"><style>

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
<div class="webaudio-knob-body" tabindex="1" touch-action="none" style="background-image: url(&quot;./img/knobs/Jambalaya.png&quot;); background-size: 40px 4040px; outline: none; width: 40px; height: 40px; background-position: 0px -4000px; transform: rotate(0deg);"></div><div class="webaudioctrl-tooltip" style="display: inline-block; width: auto; height: auto; transition: opacity 0.1s, visibility 0.1s; opacity: 0; visibility: hidden; left: 1002.74px; top: -36.5px;">1.00</div>
</webaudio-knob></div><div class="drag" style="padding: 1px; margin: 1px; text-align: center; display: inline-block; box-sizing: border-box; touch-action: none; position: absolute; top: 357.087px; left: 0.889191px; width: 69.0199px; height: 78.6648px; transform: translate(341.219px, -333.32px);" data-x="341.21875" data-y="-333.3203125"><webaudio-knob id="/VintageAmp60s/Presense" src="./img/knobs/Jambalaya.png" sprites="100" min="0" max="1" step="0.01" width="40" height="40" style="touch-action: none; display: block;"><style>

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
<div class="webaudio-knob-body" tabindex="1" touch-action="none" style="background-image: url(&quot;./img/knobs/Jambalaya.png&quot;); background-size: 40px 4040px; outline: none; width: 40px; height: 40px; background-position: 0px -4000px; transform: rotate(0deg);"></div><div class="webaudioctrl-tooltip" style="display: inline-block; width: auto; height: auto; transition: opacity 0.1s, visibility 0.1s; opacity: 0; visibility: hidden; left: 1011.8px; top: -36.5px;">1.00</div>
</webaudio-knob></div><div class="drag" style="padding: 1px; margin: 1px; text-align: center; display: inline-block; box-sizing: border-box; touch-action: none; position: absolute; top: 437.74px; left: 7.93465px; width: 47.1023px; height: 78.6648px; transform: translate(274.969px, -412.848px);" data-x="274.96875" data-y="-412.84765625"><webaudio-knob id="/VintageAmp60s/Treble" src="./img/knobs/Jambalaya.png" sprites="100" min="0" max="1" step="0.01" width="40" height="40" style="touch-action: none; display: block;"><style>

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
<div class="webaudio-knob-body" tabindex="1" touch-action="none" style="background-image: url(&quot;./img/knobs/Jambalaya.png&quot;); background-size: 40px 4040px; outline: none; width: 40px; height: 40px; background-position: 0px -3680px; transform: rotate(0deg);"></div><div class="webaudioctrl-tooltip" style="display: inline-block; width: auto; height: auto; transition: opacity 0.1s, visibility 0.1s; opacity: 0; visibility: hidden; left: 1000.84px; top: -36.5px;">0.92</div>
</webaudio-knob></div><div class="drag" style="padding: 1px; margin: 1px; text-align: center; display: inline-block; box-sizing: border-box; touch-action: none; position: absolute; top: 518.393px; left: 3.48152px; width: 56.0156px; height: 78.6648px; transform: translate(9.77734px, -495.059px);" data-x="9.77734375" data-y="-495.05859375"><webaudio-knob id="/VintageAmp60s/Volume" src="./img/knobs/Jambalaya.png" sprites="100" min="0" max="1" step="0.01" width="40" height="40" style="touch-action: none; display: block;"><style>

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
<div class="webaudio-knob-body" tabindex="1" touch-action="none" style="background-image: url(&quot;./img/knobs/Jambalaya.png&quot;); background-size: 40px 4040px; outline: none; width: 40px; height: 40px; background-position: 0px -520px; transform: rotate(0deg);"></div><div class="webaudioctrl-tooltip" style="display: inline-block; width: auto; height: auto; transition: opacity 0.1s, visibility 0.1s; opacity: 0; visibility: hidden; left: 1004.3px; top: -36.5px;">0.13</div>
</webaudio-knob></div><label for="VintageAmp60s" style="display: block; touch-action: none; position: absolute; z-index: 1; width: 280px; left: 1.89488px; top: 4.39346px; transform: translate(121.031px, 117.336px); border: none; font-family: &quot;Gloria Hallelujah&quot;; font-size: 32px; color: rgb(255, 255, 255); -webkit-text-stroke: 1px rgb(189, 81, 81);" class="drag" contenteditable="false" data-x="121.03125" data-y="117.3359375" font="Gloria Hallelujah">VintageAmp60s</label><label for="Bass" style="text-align: center; display: block; touch-action: none; position: absolute; z-index: 1; width: 100px; left: 13.3793px; top: 82.9446px; transform: translate(111.395px, -7.82812px); border: none; font-family: &quot;Gloria Hallelujah&quot;; color: rgb(255, 255, 255);" class="drag" contenteditable="false" data-x="111.39453125" data-y="-7.828125" font="Gloria Hallelujah">Bass</label><label for="Bright" style="text-align: center; display: block; touch-action: none; position: absolute; z-index: 1; width: 100px; left: 3.77698px; top: 165.189px; transform: translate(428.512px, -70.8117px); border: none; font-family: &quot;Gloria Hallelujah&quot;; color: rgb(255, 255, 255);" class="drag" contenteditable="false" data-x="428.51168059902335" data-y="-70.81167009542105" font="Gloria Hallelujah">Bright</label><label for="Master" style="text-align: center; display: block; touch-action: none; position: absolute; z-index: 1; width: 100px; left: 8.29402px; top: 245.842px; transform: translate(44.4375px, -170.902px); border: none; font-family: &quot;Gloria Hallelujah&quot;; color: rgb(255, 255, 255);" class="drag" contenteditable="false" data-x="44.4375" data-y="-170.90234375" font="Gloria Hallelujah">Master</label><label for="Middle" style="text-align: center; display: block; touch-action: none; position: absolute; z-index: 1; width: 100px; left: 8.92613px; top: 326.496px; transform: translate(176.445px, -251.582px); border: none; font-family: &quot;Gloria Hallelujah&quot;; color: rgb(255, 255, 255);" class="drag" contenteditable="false" data-x="176.4453125" data-y="-251.58203125" font="Gloria Hallelujah">Middle</label><label for="Presense" style="text-align: center; display: block; touch-action: none; position: absolute; z-index: 1; width: 100px; left: 3.77698px; top: 407.149px; transform: translate(322.652px, -331.34px); border: none; font-family: &quot;Gloria Hallelujah&quot;; color: rgb(255, 255, 255);" class="drag" contenteditable="false" data-x="322.65234375" data-y="-331.33984375" font="Gloria Hallelujah">Presense</label><label for="Treble" style="text-align: center; display: block; touch-action: none; position: absolute; z-index: 1; width: 100px; left: 10.8224px; top: 487.803px; transform: translate(235.987px, -412.409px); border: none; font-family: &quot;Gloria Hallelujah&quot;; color: rgb(255, 255, 255);" class="drag" contenteditable="false" data-x="235.9872703448524" data-y="-412.40943104403664" font="Gloria Hallelujah">Treble</label><label for="Volume" style="text-align: center; display: block; touch-action: none; position: absolute; z-index: 1; width: 100px; left: 6.36931px; top: 568.456px; transform: translate(-17.9311px, -494.538px); border: none; font-family: &quot;Gloria Hallelujah&quot;; color: rgb(255, 255, 255);" class="drag" contenteditable="false" data-x="-17.931077007260683" data-y="-494.5376618286892" font="Gloria Hallelujah">Volume</label></div>`;
  
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
        this._root.getElementById('/VintageAmp60s/Bass').value = this._plug.audioNode.getParamValue('/VintageAmp60s/Bass');
        

        this._root.getElementById('/VintageAmp60s/Master').value = this._plug.audioNode.getParamValue('/VintageAmp60s/Master');
        

        this._root.getElementById('/VintageAmp60s/Middle').value = this._plug.audioNode.getParamValue('/VintageAmp60s/Middle');
        

        this._root.getElementById('/VintageAmp60s/Presense').value = this._plug.audioNode.getParamValue('/VintageAmp60s/Presense');
        

        this._root.getElementById('/VintageAmp60s/Treble').value = this._plug.audioNode.getParamValue('/VintageAmp60s/Treble');
        

        this._root.getElementById('/VintageAmp60s/Volume').value = this._plug.audioNode.getParamValue('/VintageAmp60s/Volume');
        

          this._root.getElementById('/VintageAmp60s/Bright').value = 1 - this._plug.audioNode.getParamValue('/VintageAmp60s/Bright');
         
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
                 this._root.getElementById("/VintageAmp60s/Bass").addEventListener("input", (e) =>this._plug.audioNode.setParamValue("/VintageAmp60s/Bass", e.target.value));
this._root.getElementById("/VintageAmp60s/Master").addEventListener("input", (e) =>this._plug.audioNode.setParamValue("/VintageAmp60s/Master", e.target.value));
this._root.getElementById("/VintageAmp60s/Middle").addEventListener("input", (e) =>this._plug.audioNode.setParamValue("/VintageAmp60s/Middle", e.target.value));
this._root.getElementById("/VintageAmp60s/Presense").addEventListener("input", (e) =>this._plug.audioNode.setParamValue("/VintageAmp60s/Presense", e.target.value));
this._root.getElementById("/VintageAmp60s/Treble").addEventListener("input", (e) =>this._plug.audioNode.setParamValue("/VintageAmp60s/Treble", e.target.value));
this._root.getElementById("/VintageAmp60s/Volume").addEventListener("input", (e) =>this._plug.audioNode.setParamValue("/VintageAmp60s/Volume", e.target.value));

              }
          
              setSliders() {
                 
              }
          
              setSwitches() {
                 this._root.getElementById("/VintageAmp60s/Bright").addEventListener("change", (e) =>this._plug.audioNode.setParamValue("/VintageAmp60s/Bright", 1 - e.target.value));

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
          customElements.define('wap-vintageamp60s', 
                                VintageAmp60sGui);
          console.log("Element defined");
      } catch(error){
          console.log(error);
          console.log("Element already defined");      
      }
      