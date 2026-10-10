window.AmpsimUtility = class AmpsimUtility extends WebAudioPluginCompositeNode {
  constructor(ctx, URL, options) {
    super(ctx, URL, options);
    /*    ################     API PROPERTIES    ###############   */
    this.params = {
      inputGain: 1.0,
      noiseGate: -120,
      leftInput: true,
      rightInput: true,
    };
    super.setup();
  }
  
  createNodes() {
    this.splitterRightAfterInput = this.context.createChannelSplitter(2);

    this.merger = this.context.createChannelMerger(2);
    this.inGain = this.context.createGain();
    this.splitterInBeforeAnalysers = this.context.createChannelSplitter(2);

    this.splitterOut = this.context.createChannelSplitter(2);
  }
  scriptExists(url) {
    return document.querySelectorAll(`script[src="${url}"]`).length > 0;
  }

  // instanciate the plugin
  buildPlugin(className, baseURL) {
    console.log(
      "Trying to instanciate class : " + className + " baseURL = " + baseURL
    );

    var plugin = new window[className](this.context, baseURL);
    return plugin;
  }

  async loadDeadGatePlugin(baseURL, className) {
    console.log(
      "loadDeadGatePlugin baseURL = " + baseURL + " className = " + className
    );

    return new Promise((resolve, reject) => {
      let scriptURL = baseURL + "/main.js";
      console.log("scriptURL for deadgate is : " + scriptURL);

      if (this.scriptExists(scriptURL)) {
        //script exists
        console.log("SCRIPT EXISTS WE JUST INSTANCIATE THE PLUGIN");
        resolve(this.buildPlugin(className, baseURL));
      } else {
        console.log(
          "SCRIPT DOES NOT EXIST, ADD A SCRIPT SRC=, THEN INSTANCIATE PLUGIN"
        );

        // if we are here this means that the script is not present. Add it to the document
        let script = document.createElement("script");
        script.src = scriptURL;

        script.onload = () => {
          // Once the script has been loaded instanciate the plugin
          resolve(this.buildPlugin(className, baseURL));
        };

        // will be executed before the onload above...
        document.head.appendChild(script);
      }
    });
  }

  async connectNodes() {
    // The webaudiograph of the current plugin uses another plugin (deadgate)
    // let's load it...

    var deadgatePluginURL = this.URL + "/deadgate";
    var deadgateClassName = "FaustFaustDeadGate";
    let plugin = await this.loadDeadGatePlugin(
      deadgatePluginURL,
      deadgateClassName
    );

    //let plugin = this.buildPlugin(deadgateClassName, deadgatePluginURL);
    // We can build the graph only when the other plugin is loaded (without GUI)
    plugin.load().then((node) => {
      this.deadgateFaust = node; // on le stocke...

      // audio route
      this._input.connect(this.splitterRightAfterInput);
      // by default connect left channel to left of merger
      // and right to right... nothing special here....
      this.splitterRightAfterInput.connect(this.merger, 0, 0);
      this.splitterRightAfterInput.connect(this.merger, 1, 1);

      this.merger.connect(this.inGain);
      this.inGain.connect(this.deadgateFaust);
      this.deadgateFaust.connect(this._output);
      //this.inGain.connect(this._output);

      // analyzers' route
      // in
      this.inGain.connect(this.splitterInBeforeAnalysers);
     
      // out
      this.deadgateFaust.connect(this.splitterOut);
    });
  }

  setInputRoutes(left, right) {
    if (left) {
      this.splitterRightAfterInput.connect(this.merger, 0, 0);
    } else {
      try {
        this.splitterRightAfterInput.disconnect(this.merger, 0, 0);
      } catch (err) {
        //console.log("left channel was already disconnected");
      }
    }
    if (right) {
      this.splitterRightAfterInput.connect(this.merger, 1, 1);
    } else {
      try {
        this.splitterRightAfterInput.disconnect(this.merger, 1, 1);
      } catch (err) {
        //console.log("right channel was already disconnected");
      }
    }
    this.peakMeterInput.setActivatedInputs(left, right);
  }

  setParam(key, value) {
    try {
      this[key] = value;
    } catch (error) {
      console.warn("this plugin does not implement this param");
    }
  }

  set inputGain(_value) {
    this.params.inputGain = _value;
    // to store the new value
    this.inGain.gain.setValueAtTime(_value, this.context.currentTime);
  }

  set noiseGate(_value) {
    this.params.noiseGate = _value;

    if (this.deadgateFaust) {
      this.deadgateFaust.setParam("/kpp_deadgate/Noise_Gate", _value);
    } else {
      //console.log("deadgate faust not loaded yet...");
    }
  }

  set inputLeft(_value) {
    this.params.inputLeft = _value;
  }

  set inputRight(_value) {
    this.params.inputLeft = _value;
  }

  // ----- new implementation of volume meter
  createMeterNodeInput(meterElement) {
    var sourceNode = this._input;

    this.peakMeterInput = new webAudioPeakMeter(
      this.context,
      sourceNode,
      meterElement
    );
  }
  createMeterNodeOutput(meterElement) {
    var sourceNode = this.splitterOut;
    var peakMeter = new webAudioPeakMeter(
      this.context,
      sourceNode,
      meterElement
    );
    peakMeter.getMeterNode().connect(this.context.destination);

    /*
    var sourceNode = this.splitterOut;

    var meterNode = webAudioPeakMeterO.createMeterNode(sourceNode, this.context);
    webAudioPeakMeter.createMeter(meterElement, meterNode, {});
    */
  }
};

/* Adapted from https://esonderegger.github.io/web-audio-peak-meter/
This licence only applies to the WebAudioPeakMeter class.
MIT Licence
Copyright © <date>, <copyright holders>
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the “Software”), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

The Software is provided “as is”, without warranty of any kind, express or implied, including but not limited to the warranties of merchantability, fitness for a particular purpose and noninfringement. In no event shall the authors or copyright holders X be liable for any claim, damages or other liability, whether in an action of contract, tort or otherwise, arising from, out of or in connection with the software or the use or other dealings in the Software.

Except as contained in this notice, the name of the <copyright holders> shall not be used in advertising or otherwise to promote the sale, use or other dealings in this Software without prior written authorization from the <copyright holders>.
*/
class webAudioPeakMeter {
  options = {
    borderSize: 2,
    fontSize: 7,
    backgroundColor: "black",
    tickColor: "#ddd",
    labelColor: "#ddd",
    gradient: ["red 1%", "#ff0 16%", "lime 45%", "#080 100%"],
    dbRange: 48,
    dbTickSize: 6,
    maskTransition: "0.1s",
  };
  tickWidth;
  elementWidth;
  elementHeight;
  meterHeight;
  meterWidth;
  meterTop;
  vertical = true;
  channelCount = 1;
  channelMasks = [];
  channelPeaks = [];
  channelPeakLabels = [];
  maskSizes = [];
  textLabels = [];
  leftInputActivated = true;
  rightInputActivated = true;
  
  constructor(context, sourceNode, element, options) {
    this.ctx = context;
    this.element = element;
    if (options != undefined) this.options = options;

    var c = sourceNode.channelCount;
    this.meterNode = this.ctx.createScriptProcessor(2048, c, c);
    sourceNode.connect(this.meterNode);
    this.meterNode.connect(this.ctx.destination); // nedded otherwise no onaudioprocessing calls

    this.createMeter(this.element, this.meterNode, this.options);
  }

  setActivatedInputs(left, right) {
    this.leftInputActivated = left;
    this.rightInputActivated = right;
  }
  getMeterNode() {
    return this.meterNode;
  }

  getBaseLog(x, y) {
    return Math.log(y) / Math.log(x);
  }

  dbFromFloat(floatVal) {
    return this.getBaseLog(10, floatVal) * 20;
  }

  setOptions(userOptions) {
    for (var k in userOptions) {
      if (userOptions.hasOwnProperty(k)) {
        this.options[k] = userOptions[k];
      }
    }
    this.tickWidth = this.options.fontSize * 2.0;
    this.meterTop = this.options.fontSize * 1.5 + this.options.borderSize;
  }

  createContainerDiv(parent) {
    var meterElement = document.createElement("div");
    meterElement.style.position = "relative";
    meterElement.style.width = this.elementWidth + "px";
    meterElement.style.height = this.elementHeight + "px";
    meterElement.style.backgroundColor = this.options.backgroundColor;
    parent.appendChild(meterElement);
    return meterElement;
  }

  createMeter(domElement, meterNode, optionsOverrides) {
    this.setOptions(optionsOverrides);
    this.elementWidth = domElement.clientWidth;
    this.elementHeight = domElement.clientHeight;

    var meterElement = this.createContainerDiv(domElement);
    if (this.elementWidth > this.elementHeight) {
      this.vertical = false;
    }
    this.meterHeight =
      this.elementHeight - this.meterTop - this.options.borderSize;
    this.meterWidth =
      this.elementWidth - this.tickWidth - this.options.borderSize;

    this.createTicks(meterElement);

    this.createRainbow(
      meterElement,
      this.meterWidth,
      this.meterHeight,
      this.meterTop,
      this.tickWidth
    );

    this.channelCount = meterNode.channelCount;

    var channelWidth = this.meterWidth / this.channelCount;
    if (!this.vertical) {
      channelWidth = this.meterHeight / this.channelCount;
    }
    var channelLeft = this.tickWidth;
    if (!this.vertical) {
      channelLeft = this.meterTop;
    }
    for (var i = 0; i < this.channelCount; i++) {
      this.createChannelMask(
        meterElement,
        this.options.borderSize,
        this.meterTop,
        channelLeft,
        false
      );

      this.channelMasks[i] = this.createChannelMask(
        meterElement,
        channelWidth,
        this.meterTop,
        channelLeft,
        this.options.maskTransition
      );
      this.channelPeaks[i] = 0.0;
      this.channelPeakLabels[i] = this.createPeakLabel(
        meterElement,
        channelWidth,
        channelLeft
      );
      channelLeft += channelWidth;
      this.maskSizes[i] = 0;
      this.textLabels[i] = "-∞";
    }

    this.meterNode.addEventListener("audioprocess", (event) =>
      this.updateMeter(event)
    );
    /*
    this.meterNode.onaudioprocess = function() {
      console.log("fffgg")
    }
    */
    meterElement.addEventListener(
      "click",
      () => {
        for (var i = 0; i < this.channelCount; i++) {
          this.channelPeaks[i] = 0.0;
          this.textLabels[i] = "-∞";
        }
      },
      false
    );
    this.paintMeter();
  }

  createTicks(parent) {
    var numTicks = Math.floor(this.options.dbRange / this.options.dbTickSize);
    var dbTickLabel = 0;

    if (this.vertical) {
      var dbTickTop = this.options.fontSize + this.options.borderSize;

      for (var i = 0; i < numTicks; i++) {
        var dbTick = document.createElement("div");
        parent.appendChild(dbTick);
        dbTick.style.width = this.tickWidth + "px";
        dbTick.style.textAlign = "right";
        dbTick.style.color = this.options.tickColor;
        dbTick.style.fontSize = this.options.fontSize + "px";
        dbTick.style.position = "absolute";
        dbTick.style.top = dbTickTop + "px";
        dbTick.textContent = dbTickLabel + "";
        dbTickLabel -= this.options.dbTickSize;
        dbTickTop += this.meterHeight / numTicks;
      }
    } else {
      this.tickWidth = this.meterWidth / numTicks;
      var dbTickRight = this.options.fontSize * 2;

      for (var i = 0; i < numTicks; i++) {
        var dbTick = document.createElement("div");
        parent.appendChild(dbTick);
        dbTick.style.width = this.tickWidth + "px";
        dbTick.style.textAlign = "right";
        dbTick.style.color = this.options.tickColor;
        dbTick.style.fontSize = this.options.fontSize + "px";
        dbTick.style.position = "absolute";
        dbTick.style.right = dbTickRight + "px";
        dbTick.textContent = dbTickLabel + "";
        dbTickLabel -= this.options.dbTickSize;
        dbTickRight += this.tickWidth;
      }
    }
  }

  createRainbow(parent, width, height, top, left) {
    var rainbow = document.createElement("div");
    parent.appendChild(rainbow);
    rainbow.style.width = width + "px";
    rainbow.style.height = height + "px";
    rainbow.style.position = "absolute";
    rainbow.style.top = top + "px";
    if (this.vertical) {
      rainbow.style.left = left + "px";
      var gradientStyle =
        "linear-gradient(to bottom, " + this.options.gradient.join(", ") + ")";
    } else {
      rainbow.style.left = this.options.borderSize + "px";
      var gradientStyle =
        "linear-gradient(to left, " + this.options.gradient.join(", ") + ")";
    }
    rainbow.style.backgroundImage = gradientStyle;
    return rainbow;
  }

  createPeakLabel(parent, width, left) {
    var label = document.createElement("div");
    parent.appendChild(label);
    // MICHEL BUFFA
    label.style.display = "none";
    label.style.textAlign = "center";
    label.style.color = this.options.labelColor;
    label.style.fontSize = this.options.fontSize + "px";
    label.style.position = "absolute";
    label.textContent = "-∞";
    if (this.vertical) {
      label.style.width = width + "px";
      label.style.top = this.options.borderSize + "px";
      label.style.left = left + "px";
    } else {
      label.style.width = this.options.fontSize * 2 + "px";
      label.style.right = this.options.borderSize + "px";
      label.style.top = width * 0.25 + left + "px";
    }
    return label;
  }

  createChannelMask(parent, width, top, left, transition) {
    var channelMask = document.createElement("div");
    parent.appendChild(channelMask);
    channelMask.style.position = "absolute";
    if (this.vertical) {
      channelMask.style.width = width + "px";
      channelMask.style.height = this.meterHeight + "px";
      channelMask.style.top = top + "px";
      channelMask.style.left = left + "px";
    } else {
      channelMask.style.width = this.meterWidth + "px";
      channelMask.style.height = width + "px";
      channelMask.style.top = left + "px";
      channelMask.style.right = this.options.fontSize * 2 + "px";
    }
    channelMask.style.backgroundColor = this.options.backgroundColor;
    if (transition) {
      if (this.vertical) {
        channelMask.style.transition = "height " + this.options.maskTransition;
      } else {
        channelMask.style.transition = "width " + this.options.maskTransition;
      }
    }
    return channelMask;
  }

  maskSize(floatVal) {
    var meterDimension = this.vertical ? this.meterHeight : this.meterWidth;
    if (floatVal === 0.0) {
      return meterDimension;
    } else {
      var d = this.options.dbRange * -1;
      var returnVal = Math.floor(
        (this.dbFromFloat(floatVal) * meterDimension) / d
      );
      if (returnVal > meterDimension) {
        return meterDimension;
      } else {
        return returnVal;
      }
    }
  }

  updateMeter(audioProcessingEvent) {
    var inputBuffer = audioProcessingEvent.inputBuffer;
    var i;
    var channelData = [];
    var channelMaxes = [];

    for (i = 0; i < this.channelCount; i++) {
      channelData[i] = inputBuffer.getChannelData(i);
      channelMaxes[i] = 0.0;
    }

    for (var sample = 0; sample < inputBuffer.length; sample++) {
      for (i = 0; i < this.channelCount; i++) {
        if (Math.abs(channelData[i][sample]) > channelMaxes[i]) {
          channelMaxes[i] = Math.abs(channelData[i][sample]);
        }
      }
    }

    for (i = 0; i < this.channelCount; i++) {
      if((this.leftInputActivated && i === 0) || (this.rightInputActivated && i === 1)) {
      this.maskSizes[i] = this.maskSize(channelMaxes[i], this.meterHeight);
      } else  {
        this.maskSizes[i] = this.meterHeight;
      }

      if (channelMaxes[i] > this.channelPeaks[i]) {
        this.channelPeaks[i] = channelMaxes[i];
        this.textLabels[i] = this.dbFromFloat(this.channelPeaks[i]).toFixed(1);
      }
    }
  }

  paintMeter() {
    for (var i = 0; i < this.channelCount; i++) {
      if (this.vertical) {
        this.channelMasks[i].style.height = this.maskSizes[i] + "px";
      } else {
        this.channelMasks[i].style.width = this.maskSizes[i] + "px";
      }
      this.channelPeakLabels[i].textContent = this.textLabels[i];
    }
    window.requestAnimationFrame(() => {
      this.paintMeter();
    });
  }
}

window.WasabiAmpsimUtility = class WasabiAmpsimUtility extends WebAudioPluginFactory {
  constructor(context, baseUrl) {
    super(context, baseUrl);
  }
};
