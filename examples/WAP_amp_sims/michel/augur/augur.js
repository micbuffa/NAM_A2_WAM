var WAM = WAM || {}
if (!WAM.origin) {
  let path = document.currentScript.src.split("/");
  WAM.origin = path.slice(0,path.length-1).join("/") + "/";
}

WAM.AUGUR = class Augur extends WAMController
{
  constructor (actx) {
    var options = { numberOfInputs:0, numberOfOutputs:1, outputChannelCount:[2] }
    super(actx, "Augur", options);

    var self = this;
    this.port.onmessage = function (e) {
      var msg = e.data;
      try      { msg = JSON.parse(msg); }
      catch(e) { }
      if (msg) {
        if (msg.type == "descriptor")
          self.descriptor = msg.data;
        self.onmessage(msg);
      }
    }

    this.ws = null;
    if (!this.context)
      this.context = actx;

    this._gui = document.createElement("wam-augur");
    this._gui.origin = WAM.origin;
    this._gui.plug = this;

    this.banks = WAM.AUGUR.banklist;
    this.bank  = [];
    this.patchIndex = 0;
    this.patchNames = [];
    this.patch = undefined;
    this._defpatch = 6;
  }

  get title () { return "AugurVS"; }
  get defpatch () { return this._defpatch; }
  get gui () { return this._gui; }

  static importScripts (actx) {
    return new Promise( (resolve) => {
      actx.audioWorklet.addModule(WAM.origin + WAM.AUGUR.subdir + "wasm/augur/augur-wasm.js").then(() => {
      actx.audioWorklet.addModule(WAM.origin + WAM.AUGUR.subdir + "wasm/augur/augur-emsc.js").then(() => {
      actx.audioWorklet.addModule(WAM.origin + WAM.AUGUR.subdir + "wasm/augur/augur-awp.js").then(() => {
        resolve();
      }) }) });
    })
  }

  loadGUI () {
    var self = this;
    return new Promise((resolve,reject) => {
      let link = document.createElement('link');
      link.rel = 'import';
      link.href = WAM.origin + WAM.AUGUR.subdir + "augur.html";
      link.onload = () => {
        self._gui = document.createElement("wam-augur");
        self._gui.plug = self;
        self._gui.origin = WAM.origin;
        resolve(self._gui);
      }
      document.head.appendChild(link);
    });
  }

  selectPatch (index) {
    if (0 <= index && index < this.bank.length) {
      this.setParam("currentProgram", index);
      this.patch = this.bank[index];
      if (this._gui) this._gui.setPatch(this.patch);
      this.patchIndex = index;
      return this.patch;
    }
    else return undefined;
  }

  parseFXB (ab) {
    var bytes = new Uint8Array(ab);
    if (bytes[0] != 86 || bytes[1] != 83 || bytes[2] != 66 || bytes[3] != 0)
      return null;

    var id = new Uint32Array(ab);
    var size = id[1];
    var version = id[2];
    var count = id[3];
    var curp = id[4];

    this.bank = [];
    this.patchNames = [];
    var pos = 0;
    for (var p=0; p<count; p++) {
      var cp = 20 + pos;
      var cip = (cp/4)|0;
      var csize = id[cip];
      var name = "";
      for (var i=4; i<32; i++) {
        var b = bytes[cp+i];
        if (b == 0) break;
        name += String.fromCharCode(b);
      }
      this.patchNames.push(name);
      this.bank.push(bytes.subarray(cp+32,cp+csize));
      pos += csize;
    }

    return bytes;
  }

  loadBank (bankname) {
    var self = this;
    let name = bankname;
    return new Promise( function (resolve,reject) {
      bankname = WAM.origin + "../presets/augur/" + bankname;
      fetch(bankname).then( function (result) {
        result.arrayBuffer().then( function (ab) {

          if (bankname.indexOf(".fxb") > 0)
            ab = ab.slice(160);
          var bin = self.parseFXB(ab);

          if (bin) {
            self.bank.url = name;
            self.bank.name = name;
            self.setPatch(bin.buffer);
            resolve(self.patchNames);
          }
          else reject();
      }) });
    });
  }

  onmessage (msg) {
    if (msg.verb == "reply") {
      if (msg.prop.indexOf("wave") == 0) {
        let data = new Int16Array(msg.data);
        let wave = new Float32Array(data.length);
        for (let n=0; n<data.length; n++)
          wave[n] = 2 * data[n] / 4096 - 1;
        if (msg.prop == "waves") {
          this.waves = wave;
          this._gui.drawWaves(0);
          for (let i=0; i<4; i++) {
            let x = this._gui.params[i*3].scaledValue - 32;
            let w = this.waves.subarray(x*128, (x+1)*128);
            this._gui.drawWave(i, w);
          }
          this._gui._selectOSC(0);
        }
        else if (msg.prop.indexOf("wave/") == 0) {
          let w = msg.prop.substring(5) | 0;
          this._gui.drawWave(w, wave);
        }
      }
      else if (msg.prop.indexOf("spect") == 0) {
        let spect = new Float32Array(msg.data);
        let db = new Float32Array(spect.length);
        for (var n=0; n<spect.length; n++)
          if (spect[n] != 0)
            db[n] = 20 * Math.log10(spect[n]);
          else db[n] = -120;

        let min = Math.min.apply(Math, db);
        let max = Math.max.apply(Math, db);

        for (var n=0; n<db.length; n++) {
          db[n] -= max;
          if (db[n] < -60) db[n] = -120;
          db[n] /= (max - min);
        }

        this._gui.drawSpect(db);
      }
    }
  }

  // -- get current state
  //
  getState () {
    let state = { bank: this.bank.url, bankName: this.bank.name, patchIndex: this.patchIndex }
    let params = [];
    for (let i=0; i<this._gui.params.length; i++) {
      params.push(this._gui.params[i].scaledValue);
    }
    state.data = params;
    return Promise.resolve(state);
  }

  // -- restore current state
  //
  setState (s) {
    let self = this;
    return new Promise(async (resolve,reject) => {
      let state = JSON.parse(s);
      await self.loadBank(state.bank);
      self.selectPatch(state.patchIndex);

      let feg = { level:[0,0,0,0,0], rate:[0,0,0,0,0] }
      let aeg = { level:[0,0,0,0,0], rate:[0,0,0,0,0] }

      setTimeout(() => {
      for (let i=0; i<self._gui.params.length; i++) {
        // -- feg
        if (31 <= i && i <= 39) {
          let n = i - 31;
          let j = (n / 2) | 0;
          if (n % 2 == 0)  feg.level[j]  = state.data[i];
          else             feg.rate[j+1] = state.data[i];
        }
        // -- aeg
        else if (42 <= i && i <= 49) {
          let n = i - 42;
          let j = (n / 2) | 0;
          if (n % 2 == 0)  aeg.level[j]  = state.data[i];
          else             aeg.rate[j+1] = state.data[i];
        }
        let v = state.data[i];
        self._gui.params[i].setValue(v);
      }
      self._gui.widgets.feg.value = feg;
      self._gui.widgets.aeg.value = aeg;
      self._gui.matrix.restoreToggles(self._gui.params);
      resolve();
      }, 1000);
    });
  }
}
WAM.AUGUR.title = "Augur";
WAM.AUGUR.subdir = "";


WAM.AUGUR.banklist = [
  "Ann_Bank01.fxb",
  "Prophesy_1.fxb",
  "VS Patchbook-LG.fxb",
  "Augur.dat"
];
