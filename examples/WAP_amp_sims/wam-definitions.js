// 0. wam-preloader.js is loaded and evaluated
//    the preloader will be deprecated in future after WAM and WAP APIs are converged
//
// 1. this file is loaded and evaluated
// 2. async WAM.LOCAL.importScripts();  -- this is empty here
// 3. wam = new WAM.LOCAL();            -- creates plugin instance
// 4. async wam.loadGUI();              -- creates the gui and returns an html element

// to switch plugin:
// A) extend WAM_LOCAL from another class
// B) modify the tail of this.URL in constructor

//var WAM = WAM || {};

pendingImports = {};

WAM.WASABI_SC.LOCAL = class WAM_LOCAL extends CompositeAudioNode {
  constructor(actx, deviceType) {
    super(actx, WAM.WASABI_SC.LOCAL.origin);
    this.deviceType = deviceType;
    this.urlSuffix = "michel/" + deviceType;
    let fullUrl = this.URL + this.urlSuffix;
    switch (this.deviceType) {
      case "modernmetal":
        this.wam = new ModernMetalMachine(actx, fullUrl);
        break;
        case "blues":
          this.wam = new BluesMachine(actx, fullUrl);
          break;
        case "metal":
        this.wam = new MetalMachine(actx, fullUrl);
        break;
      case "metalfull":
        this.wam = new MetalMachineFull(actx, fullUrl);
        break;
      case "disto":
        this.wam = new DistoMachine(actx, fullUrl);
        break;
      case "distofull":
        this.wam = new DistoMachineFull(actx, fullUrl);
        break;
      case "clean":
        this.wam = new CleanMachine(actx, fullUrl);
        break;
      case "cleanfull":
        this.wam = new CleanMachineFull(actx, fullUrl);
        break;
      case "utility":
        this.wam = new AmpsimUtility(actx, fullUrl);
        break;
      default:
        throw Error("Invalid device type " + deviceType);
    }

    this._input.connect(this.wam);
    this.wam.connect(this._output);

    this.activated = false;
  }

  static async importScripts() {

  }

  linkExists(url) {
    return document.querySelectorAll(`link[href="${url}"]`).length > 0;
  }

  async loadGUI() {
    console.log(
      "calling loadGUI for : " + this.URL + this.urlSuffix + "/main.html"
    );
    let gui = await this.createLinkRelEqualImport(
      this.URL + this.urlSuffix + "/main.html"
    );
    return gui;
  }

  setParam(key, value) {
    this.postMessage({ type: "param", prop: key, args: value });
  }

  async loadBank() {
    return WAM.WASABI_SC.LOCAL.banklist;
  }
  getPatch(index) {
    return null;
  }
  setPatch(patch) {}

  // MICHEL BUFFA : here we should be able to save/load the whole state of the rack...
  async getState() {
    return await this.wam.getState();
  }
  async setState(state) {
    await this.wam.setState(JSON.parse(state));

    return null;
  }

  sendMessage(verb, prop, data) {}

  postMessage(msg) {
    if (msg.prop != "midi") console.log(msg);

    // for bypass, see Jari's email
    if (msg.prop == "bypass") {
      console.log("### msg.prop = " + msg.prop);
      console.log("### msg.args = " + msg.prop.args);

      // let's bypass the whole rack, if an arg is passed
      this._input.disconnect();
      this._input.connect(msg.args ? this._output : this.wam);
      // this._input.connect(msg.args ? this._output : this.wamA);
    }
  }

  createGui(url) {
    var element;
    if (url.indexOf("blues") >= 0) element = createBluesMachine(this.wam);
    else if (url.indexOf("modernmetal") >= 0) element = createModernMetalMachine(this.wam);
    else if (url.indexOf("metalfull") >= 0) element = createMetalMachineFull(this.wam);
    else if (url.indexOf("metal") >= 0) element = createMetalMachine(this.wam);
    else if (url.indexOf("distofull") >= 0) element = createDistoMachineFull(this.wam);
    else if (url.indexOf("disto") >= 0) element = createDistoMachine(this.wam);
    else if (url.indexOf("cleanfull") >= 0) element = createCleanMachineFull(this.wam);
    else if (url.indexOf("clean") >= 0) element = createCleanMachine(this.wam);
    else if (url.indexOf("utility") >= 0) element = createAmpsimUtility(this.wam);
    return element;
  }

  async createLinkRelEqualImport(url) {
    if (!pendingImports[url]) {
      pendingImports[url] = new Promise((resolve) => {
        var link = document.createElement("link");
        link.rel = "import";
        link.href = url;
        link.onload = (e) => {
          resolve();
        };
        document.head.appendChild(link);
      });
    }
    await pendingImports[url];
    return this.createGui(url);
  }
};
WAM.WASABI_SC.BluesMachine = class Blues_Machine extends WAM.WASABI_SC.LOCAL {
  constructor(actx) {
    super(actx, "blues");
  }

  static async importScripts() {
    await WAM.WASABI_SC.loadScript("blues/main.js");
  }
};
WAM.WASABI_SC.ModernMetalMachine = class Blues_Machine extends WAM.WASABI_SC.LOCAL {
  constructor(actx) {
    super(actx, "modernmetal");
  }

  static async importScripts() {
    await WAM.WASABI_SC.loadScript("modernmetal/main.js");
  }
};
WAM.WASABI_SC.MetalMachine = class Metal_Machine extends WAM.WASABI_SC.LOCAL {
  constructor(actx) {
    super(actx, "metal");
  }

  static async importScripts() {
    await WAM.WASABI_SC.loadScript("metal/main.js");
  }
};
WAM.WASABI_SC.MetalMachineFull = class Metal_MachineFull extends WAM.WASABI_SC.LOCAL {
  constructor(actx) {
    super(actx, "metalfull");
  }

  static async importScripts() {
    await WAM.WASABI_SC.loadScript("metalfull/main.js");
  }
};
WAM.WASABI_SC.DistoMachine = class Disto_Machine extends WAM.WASABI_SC.LOCAL {
  constructor(actx) {
    super(actx, "disto");
  }

  static async importScripts() {
    console.log("ADDING SCRIPTS disto/main.js");

    await WAM.WASABI_SC.loadScript("disto/main.js");
  }
};

WAM.WASABI_SC.DistoMachineFull = class Disto_Machine_Full extends WAM.WASABI_SC.LOCAL {
  constructor(actx) {
    super(actx, "distofull");
  }

  static async importScripts() {
    console.log("ADDING SCRIPTS distofull/main.js");

    await WAM.WASABI_SC.loadScript("distofull/main.js");
  }
};
WAM.WASABI_SC.CleanMachine = class Clean_Machine extends WAM.WASABI_SC.LOCAL {
  constructor(actx) {
    super(actx, "clean");
  }

  static async importScripts() {
    await WAM.WASABI_SC.loadScript("clean/main.js");
  }
};
WAM.WASABI_SC.CleanMachineFull = class Clean_MachineFull extends WAM.WASABI_SC.LOCAL {
  constructor(actx) {
    super(actx, "cleanfull");
  }

  static async importScripts() {
    await WAM.WASABI_SC.loadScript("cleanfull/main.js");
  }
};
WAM.WASABI_SC.Utility = class Wasabi_Utility extends WAM.WASABI_SC.LOCAL {
  constructor(actx) {
    super(actx, "utility");
  }

  static async importScripts() {
    //console.log("LOADING SCRIPTS utility/main.js and utility/deadgate/main.js");
    await WAM.WASABI_SC.loadScript("utility/main.js");
    await WAM.WASABI_SC.loadScript("utility/deadgate/main.js");
  }
};

WAM.WASABI_SC.LOCAL.banklist = [];
