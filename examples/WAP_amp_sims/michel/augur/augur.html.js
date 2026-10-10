
  let augurtemp = document.currentScript.ownerDocument.querySelector("#wam-augur-template");

  class AugurGUI extends HTMLElement
  {
    constructor () {
      super();
      this._root = this.attachShadow({mode: 'open'});
      this._root.appendChild(augurtemp.content.cloneNode(true));
      this._curmod;
      this._curosc = 0;
      this._curwaveGroup = 0;
      this._subsect = [0,0];
      this.widgets = {};
      this.filterModeRemap = [6, 4, 0, 7, 1, 5, 2, 3, 14, 12, 8, 15, 9, 13, 10, 11];
    }

    _initWaves () {
      let container = Array.from(this._root.querySelectorAll("#waves .waverow"));
      let wavetemp  = this._root.querySelector("#wavetemp");
      this.widgets.waves = [];
      for (let y=0; y<container.length; y++) {
        for (let x=0; x<8; x++) {
          let node = wavetemp.content.cloneNode(true);
          container[y].appendChild(node);
          node = container[y].lastElementChild;
          let box = new Wavebox(node.querySelector("canvas"), y*8+x)
          box.elem = node;
          node.box = box;
          this.widgets.waves.push(box);
          node.onclick = (e) => {
            let w = (this._curwaveGroup + 1) * 32 + e.target.box.index;
            let p = this.params[this._curosc*3];
            p.setValue(w);
            this._plug.sendMessage("get", "spect", w);
          }
        }
      }
      this._plug.sendMessage("get", "wave", -1);
      this._showWaves(0);

      let self = this;
      let groups = Array.from(this._root.querySelectorAll("#wavegroup li"));
      groups.forEach(li => { li.onclick = (e) => {
        groups.forEach(g => { g.classList.remove("selected"); })
        e.target.classList.add("selected");
        self._showWaves(groups.indexOf(e.target));
      }});

      let fft = this._root.querySelector("#fft");
      fft.style.width = "263px";
      this.widgets.spect = new Spectbox(fft);
    }

    _showWaves (group) {
      let waveNames = [
        "32 Sine", "33 Saw", "34 Sqr", "35 WmBell",
        "36 RdBell", "37 R2Bell", "38 W2Bell", "39 FmtBell",
        "40 FzReed", "41 FmtAOh", "42 FmtAhh", "43 TriPlus",
        "44 DisBel", "45 Pulse1", "46 Pulse2", "47 SqrReed",
        "48 Oohh", "49 Eehh", "50 FeedBack", "51 Piano1",
        "52 E.Pno", "53 M.Harm", "54 HiTop", "55 WmReed",
        "56 3 & 5", "57 Hollow", "58 Hvy7", "59 BelOrg",
        "60 BassBel", "61 Tine1", "62 PhSQR", "63 Orient",
        "64 HiPipe", "65 Mass", "66 ReedOrg", "67 OrgAhh",
        "68 MelOrg", "69 FmtOrg", "70 Clar", "71 AhhFem",
        "72 AhhHom", "73 AhhBass", "74 RegVox", "75 Vocal",
        "76 Homme", "77 HiAhh", "78 Bass", "79 Guitar",
        "80 Nice", "81 WWind", "82 Oboe", "83 Harp",
        "84 Pipe", "85 Hack1", "86 Hack2", "87 Hack3",
        "88 Pinch", "89 BellHrm", "90. BellVox", "91 Hi Harm",
        "92 Hi Reed", "93 BellReed", "94 WmWhstl", "95 Wood",
        "96 Pure", "97 Med Pure", "98 HiHarm", "99 FullBell",
        "100 Bell", "101 Pinch", "102 Clustr", "103 M.Pinch",
        "104 VoxPnch", "105 OrgPnch", "106 AhhPnch", "107 PnoOrg",
        "108 BrReed", "109 NoFund", "110 ReedHrm", "111 LiteFund",
        "112 MelOrg", "113 Bell", "114 Bell", "115 3&5Saw",
        "116 5thSin", "117 Sin2Oct", "118 Sin4Oct", "119 Saw5th",
        "120 Saw2Oct", "121 Sqr5th", "122 Sqr5Oct", "123 Sqr2Oct",
        "124 WarmLo", "125 Bells", "126 *null*", "127 Noise" ];

      let container = Array.from(this._root.querySelectorAll("#waves .waverow"));
      for (let y=0; y<container.length; y++) {
        let row  = container[y];
        for (let x=0; x<8; x++) {
          let node = row.children[x].children[1];
          node.innerHTML = waveNames[group*32 + y*8 + x];
        }
      }

      this._curwaveGroup = group;

      if (this._plug.waves) {
        let curwave = this.params[this._curosc*3].scaledValue - 32;
        this.widgets.waves[curwave % 32].selected = (Math.floor(curwave / 32) == group);
        this.drawWaves(group);
      }
    }

    drawWave (index, data) {
      this.widgets.oscwaves[index].wave = data;
    }

    drawWaves (group) {
      let startIndex = group * 32;
      for (let i=startIndex; i<startIndex + 32; i++) {
        let w = this._plug.waves.subarray(i*128, (i+1)*128);
        this.widgets.waves[i % 32].wave = w;
      }

      let w = this.params[this._curosc*3].scaledValue;
      this._plug.sendMessage("get", "spect", w);
    }

    drawSpect (data) {
      this.widgets.spect.data = data;
    }

    _selectOSC (i) {
      this.widgets.oscs[this._curosc].classList.remove("selected");
      let curwave = this.params[this._curosc*3].scaledValue;
      this.widgets.waves[curwave % 32].selected = false;

      this._curosc = i;
      this.widgets.oscs[this._curosc].classList.add("selected");
      curwave = this.params[this._curosc*3].scaledValue - 32;
      let curgroup = (curwave / 32) | 0;
      if (curgroup != this._curwaveGroup) {
        let groups = Array.from(this._root.querySelectorAll("#wavegroup li"));
        groups.forEach(g => { g.classList.remove("selected"); })
        groups[curgroup].classList.add("selected");
        this._showWaves(curgroup);
      }
      this.widgets.waves[curwave % 32].selected = true;
    }

    get width ()  { return 838; }
    get height () { return 556; }
    set plug (p)  {
      this._plug = p;
    }
    set origin (origin) {
      var self = this;
      setTimeout( function () { self._setupControls(origin); }, 10);
    }

    _setupControls (origin) {
      origin += WAM.AUGUR.subdir + "/wasm/augur/res/";
      this._initParams();
      this._initMods();
      this._initMatrix();
      this._initMixEG();
      this._initControls();
      this._initWaves();
    }

    valueChanged (param) {
      if (param.id < 10 && (param.id % 3 == 0)) {
        if (this._plug.waves) {
          let w = param.scaledValue - 32;
          this.drawWave(param.id/3, this._plug.waves.subarray(w*128, (w+1)*128));
          this._plug.sendMessage("get", "spect", w+32);

          let curgroup = (w / 32) | 0;
          if (curgroup != this._curwaveGroup) {
            let groups = Array.from(this._root.querySelectorAll("#wavegroup li"));
            groups.forEach(g => { g.classList.remove("selected"); })
            groups[curgroup].classList.add("selected");
            this._showWaves(curgroup);
          }
          this.widgets.waves.forEach(w => { w.selected = false; })
          this.widgets.waves[w % 32].selected = true;
        }
      }

      let pid = param.id;
      let val = param.value;
      if (pid == 180) {
        pid = 127;
        val = this.filterModeRemap.indexOf(param.scaledValue);
        val /= (this.filterModeRemap.length - 1);
      }
      else if (pid == 181) pid = 128;
      this._plug.setParam(pid, val);
    }

    _initParams () {
      var params = [];

      // -- OSC
      for (let i=0; i<4; i++) {
        let id = i * 3;
        let prefix = "osc" + String.fromCharCode(65 + i);
        params.push(new Param(id+0, prefix + "wave", 32,127,32));
        params.push(new Param(id+1, prefix + "tune", -24,24,0));
        params.push(new Param(id+2, prefix + "fine", -100,100,0));
      }

      // -- MIXEG
      for (let i=0; i<4; i++)
        params.push(new Param(i+12, "mixrate" + i, 0,99,0));
      for (let i=0; i<5; i++) {
        let id = i * 2;
        params.push(new Param(id+16, "mixX" + i, -63,63,0));
        params.push(new Param(id+17, "mixY" + i, -63,63,0));
      }
      params.push(new Param(26, "mixloop", 0,6,0));
      params.push(new Param(27, "mixrepeat", 0,8,0));

      // -- FILTER
      params.push(new Param(28, "cutoff", 0,99,0));
      params.push(new Param(29, "reso", 0,99,0));
      params.push(new Param(30, "filterEGamount", 0,99,0));

      // -- FILTER EG
      params.push(new Param(31, "fegLevel0", 0,99,0));
      for (let i=0; i<4; i++) {
        let id = i * 2;
        params.push(new Param(id+32, "fegTime" + i, 0,99,0));
        params.push(new Param(id+33, "fegLevel" + (i+1), 0,99,0));
      }
      params.push(new Param(40, "fegloop", 0,6,0));
      params.push(new Param(41, "fegrepeat", 0,8,0));

      // -- AMP EG
      for (let i=0; i<4; i++) {
        let id = i * 2;
        params.push(new Param(id+42, "aegLevel" + i, 0,99,0));
        params.push(new Param(id+43, "aegTime" + (i+1), 0,99,0));
      }
      params.push(new Param(50, "aegloop", 0,6,0));
      params.push(new Param(51, "aegrepeat", 0,8,0));

      // -- LFOs
      params.push(new Param(52, "lfoRate1", 0,99,0));
      params.push(new Param(53, "lfoWave1", 0,5,0));
      params.push(new Param(54, "lfoRate2", 0,99,0));
      params.push(new Param(55, "lfoWave2", 0,5,0));

      // -- MATRIX mod amounts
      for (let i=0; i<7; i++)
        params.push(new Param(i+56, "modsrc" + i, (1<i && i<6) ? -99:0,99,0));

      // -- AMP
      params.push(new Param(63, "volume", 0,99,0));
      params.push(new Param(64, "chorusRate", 0,99,0));
      params.push(new Param(65, "chorusDepth", 0,99,0));
      params.push(new Param(66, "chorusOn", 0,1,0));

      // -- GLOBAL
      for (let i=0; i<8; i++)
        params.push(new Param(i+67, "pan" + (i+1), -63,63,0));

      // -- MATRIX toggles
      for (let i=75; i<180; i++)
        params.push(new Param(i, "modtoggle" + i, 0,1,0));

      // -- MISC
      // -- todo: add filterType to C++ side
      params.push(new Param(180, "filterMode", 0,15,0));
      params.push(new Param(181, "polyphony", 1,32,8));
      params.push(new Param(182, "analog", 0,1,0));

      this.params = params;
      params.forEach((param) => { param.observe(this); })
    }

    _initMods () {
      // -- ENV
      var env = this._root.querySelector("#ENV");
      var tmp = this._root.querySelector("#egrow");
      for (var i=0; i<2; i++) {
        env.appendChild(document.importNode(tmp.content, true));
        var elem = env.children[env.children.length - 1];
        let envs = elem.querySelectorAll(".env");
        for (var j=0; j<envs.length; j++)
          envs[j].group = i;
        elem = elem.querySelector("select");
        elem.id = "param" + ((i == 0) ? 50 : 40);
      }
      var graphs = env.querySelectorAll("svg");
      var aeg = new EG(graphs[0], true);
      var feg = new EG(graphs[1], false);
      this.widgets.aeg = aeg;
      this.widgets.feg = feg;

      aeg.param = this.params.slice(42,50);
      feg.param = this.params.slice(31,40);

      aeg.oninput = this._onaeg.bind(this);
      feg.oninput = this._onfeg.bind(this);
      this.aegWidgets = [0,0];
      this.fegWidgets = [0,0];

      // -- selector
      var selectors = this._root.querySelectorAll(".selector li");
      for (var i=0; i<selectors.length; i++)
        selectors[i].onclick = this._onsubsect.bind(this);
      this._subsect[0] = this._root.querySelector("#selectorA li");
      this._subsect[1] = this._root.querySelector("#selectorB li");
    }

    _initMatrix () {
      var svg = this._root.querySelector("#matrix");
      this.matrix = new ModMatrix(svg, this._root, this);
      this.matrix.param = this.params;
    }

    _initMixEG () {
      var svg = this._root.querySelector("#diamond");
      var mixeg = new MixEG(svg,150,100);
      this.widgets.meg = mixeg;
      mixeg.param = this.params;

      let toggle = this._root.querySelector("#joytoggle");
      toggle.onclick = () => {
        toggle.classList.toggle("active");
        mixeg.setJoyMode(toggle.classList.contains("active"));
      }
    }

    _initControls () {
      // -- OSC
      var osc = this._root.querySelector("#OSC");
      var tmp = this._root.querySelector("#osctemplate");
      this.widgets.oscs = [];
      this.widgets.oscwaves = [];
      for (var i=0; i<4; i++) {
        osc.appendChild(document.importNode(tmp.content, true));
        var elem = osc.children[osc.children.length - 1];
        elem.querySelector(".label").innerText = String.fromCharCode(65 + i);
        elem.group = i;
        let self = this;
        let box = new Wavebox(elem.querySelector(".waveform"), i);

        let cls = ["label","wave","semi","fine","waveform"]
        cls.forEach((c) => {
          let el = elem.querySelector("." + c);
          el.oscIndex = i;
          el.addEventListener("mousedown", (e) => { self._selectOSC(e.target.oscIndex); });
        });

        this.widgets.oscwaves.push(box);
        this.widgets.oscs.push(elem.querySelector(".label"));
      }

      // -- FILTER
      var modes = ["4P BP", "3P HP + 1PLP", "3P AP + 1PLP",
                   "2P N  + 1PLP","2P LP","2P HP + 1PLP",
                   "4P LP","2P BP","2P HP + 1PLP","3P HP",
                   "3P AP","2P N","1P LP","2P HP","3P LP","1P HP"];
      var combo = this._root.querySelector("#FILTER select");
      var fm = 0;
      var self = this;
      modes.forEach((m) => { combo.appendChild( new Option(m, self.filterModeRemap[fm++]) ); });

      // -- GLOBAL
      var row = this._root.querySelectorAll(".panrow");
      var tmp = this._root.querySelector("#pantemplate");
      for (var i=0; i<2; i++) {
        var panrow = row[i];
        for (var j=0; j<4; j++) {
          panrow.appendChild(document.importNode(tmp.content, true));
          var id = i * 4 + j;
          var elem = panrow.children[panrow.children.length - 1];
          elem.querySelector("label").innerText = "PAN " + (id + 1);
          elem.querySelector(".pan").id = id;
        }
      }

      // -- LFO
      var lfowaves = ["sin","triangle","square","saw (down)","ramp (up)","random"];
      var combos = this._root.querySelectorAll("#LFO select");
      lfowaves.forEach((m) => {
        combos[0].appendChild( new Option(m) );
        combos[1].appendChild( new Option(m) );
      });

      // -- numerics
      var elems = this._root.querySelectorAll(".numeric");
      for (var i=0; i<elems.length; i++) {
        var elem = elems[i];
        var min = elem.getAttribute("min")|0;
        var max = elem.getAttribute("max")|0;
        var num = new Numeric(elem, min,max);

        // bind
        let c0 = elem.classList[0];
        let c1 = elem.classList[1];
        if (c0 == "osc") {
          let id = elem.parentElement.group * 3;
          id += (c1 == "wave") ? 0 : (c1 == "semi") ? 1 : 2;
          this.widgets[id] = num;
          num.param = this.params[id];
        }
        else if (c0 == "mix" || c0 == "lfo" || c0 == "mod") {
          let id = c1|0;
          this.widgets[id] = num;
          num.param = this.params[id];
        }
        else if (c0 == "env") {
          let id = (elem.id|0) + elem.group * 3;
          if (id <= 51) {
            this.aegWidgets[id-50] = num;
            num.id = id;
            num.oninput = this._onEG.bind(this);
          }
          else if (id == 53 || id == 54) {
            this.fegWidgets[id-53] = num;
            num.id = id;
            num.oninput = this._onEG.bind(this);
          }
          if (id == 52) {
            id = 51;
            num.param = this.params[id];
          }
          else if (id == 55) {
            id = 41;
            num.param = this.params[id];
          }
          this.widgets[id] = num;
        }
        else if (elem.id == "param181") {
          this.widgets[181] = num;
          num.param = this.params[181];
        }
      }

      // -- wave numerics
      for (let i=0; i<10; i+=3)
        this.widgets[i].scaler = 0.4;


      // -- knobs
      var elems = this._root.querySelectorAll(".knob");
      for (var i=0; i<elems.length; i++) {
        var knob = new Knob(i,elems[i],this._root);
        let cc = elems[i].classList[1];
        if (elems[i].classList[0] == "filter") {
          let id = cc|0;
          this.widgets[id] = knob;
          knob.param = this.params[id];
        }
        else if (elems[i].classList[0] == "amp") {
          let id = cc|0;
          this.widgets[id] = knob;
          knob.param = this.params[id];
        }
        else {
          let id = 67 + (elems[i].id | 0);
          this.widgets[id] = knob;
          knob.param = this.params[id];
        }
      }

      // -- toggles
      var elems = this._root.querySelectorAll(".toggle");
      for (var i=0; i<elems.length; i++) {
        var t = elems[i];
        let parent = t.id == 32 ? this._root : null;
        let id = t.id == 32 ? 182 : 66;
        var toggle = new Toggle(t,parent);
        this.widgets[id] = toggle;
        toggle.param = this.params[id];
        toggle.elem = t;
      }

      // -- choices
      let ids = [26,40,50,53,55,180];
      for (let i=0; i<ids.length; i++) {
        let id = ids[i];
        let c = new Choice(this._root.getElementById("param" + id));
        this.widgets[id] = c;
        c.param = this.params[id];
      }
    }

    _onaeg (i, level, rate) {
      if (this.aegWidgets) {
        this.aegWidgets[0].value = rate;
        this.aegWidgets[1].value = level;
      }
    }
    _onfeg (i, level, rate) {
      if (this.fegWidgets) {
        this.fegWidgets[0].value = rate;
        this.fegWidgets[1].value = level;
      }
    }
    _onEG (value, sender) {
      let target = (sender.id <= 51) ? this.widgets.aeg : this.widgets.feg;
      target.setValue(value, sender.id == 50 || sender.id == 53);
    }

    _onsubsect (e) {
      var sel = e.target;
      var index = sel.parentElement.id == "selectorA" ? 0 : 1;
      this._subsect[index].classList.remove("selected");
      this._subsect[index] = sel;
      sel.classList.add("selected");

      if (index == 0) {
        index = parseInt(sel.id.substr(-1));
        var cont = this._root.querySelector("#MIX");
        var top  = index * cont.offsetHeight;
        this._root.querySelector("#selcontainerA").scrollTop = top;
      }
      else {
        index = parseInt(sel.id.substr(-1));
        var cont = this._root.querySelector("#ENV");
        var top  = index * cont.offsetHeight;
        this._root.querySelector("#selcontainerB").scrollTop = top;
        let svg = this._root.querySelector("#matrix svg");
        svg.style.display = (index == 1) ? "block" : "none";
      }
    }

    setPatch (patch) {
      var p = new DataView(patch.buffer, patch.byteOffset);
      if (p.getUint32(0) != 0x56535000) return false;
      let i = 8;
      while (i < patch.length - 4) {
        let chunkID = p.getUint32(i,true);
        let chunkSize = p.getUint32(i+4,true);
        let version = p.getUint32(i+8,true);
        i += 12;
        switch (chunkID) {
          case 1: // osc
            if (chunkSize == 52 && version == 0) {
              for (let j=0; j<4; j++) {
                let n = j * 3;
                this.params[n+0].setValue( p.getUint32(i+n*4, true) + 32, this );
                this.params[n+1].setValue( p.getFloat32(i+(n+1)*4, true), this );
                this.params[n+2].setValue( p.getFloat32(i+(n+2)*4, true), this );

                // -- wavebox
                if (this._plug.waves) {
                  let w = this.params[n].scaledValue - 32;
                  w = this._plug.waves.subarray(w*128, (w+1)*128);
                  this.widgets.oscwaves[j].wave = w;
                }
              }
            }
            break;
          case 2: // mix
            if (chunkSize == 68 && version == 0) {
              let mix = { x:[], y:[] }
              let n = i;
              for (let j=0; j<5; j++) {
                mix.x.push( p.getFloat32(n, true) );
                mix.y.push( p.getFloat32(n+4, true) );
                this.params[j*2+16].setValue( p.getFloat32(n+0, true), this );
                this.params[j*2+17].setValue( p.getFloat32(n+4, true), this );
                n += 8;
              }
              for (let j=0; j<4; j++) {
                let v = p.getFloat32(n, true);
                v = Math.log(v/10) / Math.log(10000/10);
                this.params[12+j].setValue( 99*v | 0, this );
                n += 4;
              }

              this.params[26].setValue( p.getUint32(n+0, true), this );
              this.params[27].setValue( p.getUint32(n+4, true), this );
            }
            break;
          case 3: // filter
            if (chunkSize == 20 || chunkSize == 24) {
              if (version != 0 && version != 1) break;
              let n = i;
              this.params[28].setValue( p.getFloat32(n+0, true) / 10 * 99 | 0, this );
              this.params[29].setValue( p.getFloat32(n+4, true) * 99 | 0, this );
              this.params[30].setValue( p.getFloat32(n+8, true) / 10 * 99 | 0, this );
              this.params[180].setValue( this.filterModeRemap[p.getUint32(n+12, true)], this );
              if (version == 1)
                this.params[182].setValue( p.getUint32(n+16, true), this);
            }
            break;
          case 4: // filter eg
            if (chunkSize == 48 && version == 0) {
              let eg = { level:[], rate:[] }
              let n = i;
              for (let j=0; j<5; j++) {
                let v = p.getFloat32(n, true) * 99 | 0;
                eg.level.push(v);
                this.params[31+j*2].setValue(v, this);
                n += 4;
              }
              eg.rate.push(0);
              for (let j=0; j<4; j++) {
                eg.rate.push( p.getFloat32(n, true) * 99 | 0 );
                this.params[32+j*2].setValue( p.getFloat32(n, true) * 99 | 0, this );
                n += 4;
              }

              this.widgets.feg.value = eg;

              this.params[40].setValue( p.getUint32(n, true), this );
              this.params[41].setValue( p.getFloat32(n+4, true), this );
            }
            break;
          case 5: // amp eg
            if (chunkSize == 48 && version == 0) {
              let eg = { level:[], rate:[] }
              let n = i;
              for (let j=0; j<4; j++) {
                let v = p.getFloat32(n, true) * 99 | 0;
                eg.level.push(v);
                this.params[42+j*2].setValue(v, this);
                n += 4;
              }
              eg.level.push(0);
              eg.rate.push(0);
              n += 4;
              for (let j=0; j<4; j++) {
                eg.rate.push( p.getFloat32(n, true) * 99 | 0 );
                this.params[43+j*2].setValue( p.getFloat32(n, true) * 99 | 0, this );
                n += 4;
              }

              this.widgets.aeg.value = eg;

              this.params[50].setValue( p.getUint32(n, true), this );
              this.params[51].setValue( p.getFloat32(n+4, true), this );
            }
            break;
          case 6: // lfo
            if (chunkSize == 20 && version == 0) {
              let rate1 = p.getFloat32(i+4,  true);
              let rate2 = p.getFloat32(i+12, true);
              rate1 = Math.log(rate1/0.01) / Math.log(10/0.01);
              rate2 = Math.log(rate2/0.01) / Math.log(10/0.01);

              this.params[52].setValue( (rate1 * 99) | 0, this );
              this.params[54].setValue( (rate2 * 99) | 0, this );
              this.params[53].setValue( p.getUint32(i+0, true), this );
              this.params[55].setValue( p.getUint32(i+8, true), this );
            }
            break;
          case 7: // matrix
            if (chunkSize == 452 && version == 0) {
              // todo : bipolar for j=2..5 ??
              // todo : MODWHEEL AMOUNT (available in Augur, though not in not in VS)
              let n = i;
              for (let j=0; j<6; j++) {
                let v = p.getFloat32(n, true);
                this.params[56+j].setValue( (v * 99) | 0, this );
                n += 4;
              }

              for (let i=75; i<180; i++) {
                n += 4;
                this.params[i].setValue( p.getUint32(n, true), this );
              }
              this.matrix.setToggles(this.params, 75);
            }
            break;
          case 8:
            if (chunkSize == 40 || chunkSize == 64 || chunkSize == 68) {
              let n = i;
              if (version > 0)
                n += 24;
              let db  = p.getFloat32(n, true); // -40, 20
              this.params[63].setValue( (db+40) / (20+40) * 99 | 0, this );
              for (let j=0; j<8; j++) {
                let pan = p.getFloat32(n + 4, true);
                this.params[67+j].setValue( pan * 63 | 0, this );
                n += 4;
              }
              if (version == 2) {
                var v = (p.getFloat32(n, true) * 32) | 0;
                this.params[181].setValue( v || 8, this );
              }
              else this.params[181].setValue( 8, this );
            }
            break;
          case 9: // chorus
            if (chunkSize == 16 && version == 0) {
              let n = i;
              let rate = p.getFloat32(n, true);
              rate = Math.log(rate/0.05) / Math.log(5/0.05);
              this.params[64].setValue( rate * 99 | 0, this );
              this.params[65].setValue( p.getFloat32(n+4, true) * 99 | 0, this );
              this.params[66].setValue( p.getUint32(n+8, true), this );
            }
        }
        i += chunkSize - 4;
      }

      return true;
    }

  }

  window.customElements.define('wam-augur', AugurGUI);
