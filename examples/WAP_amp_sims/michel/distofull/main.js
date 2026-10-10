window.DistoMachineFull = class DistoMachineFull extends WebAudioPluginCompositeNode {
  constructor(ctx, URL, options) {
    super(ctx, URL, options);

    this.params = { status: "disable", preset: "5" };

    this.reverbImpulses = [
      {
        name: "Fender Hot Rod",
        url: this.URL + "/assets/impulses/reverb/cardiod-rear-levelled.wav",
      },
      {
        name: "PCM 90 clean plate",
        url: this.URL + "/assets/impulses/reverb/pcm90cleanplate.wav",
      },
      {
        name: "Scala de Milan",
        url: this.URL + "/assets/impulses/reverb/ScalaMilanOperaHall.wav",
      },
    ];
    this.cabinetImpulses = [
      {
        name: "Marshall 1960, axis",
        url: this.URL + "/assets/impulses/cabinet/Marshall1960.wav"
      },
      {
        name: "Vintage Marshall 1",
        url: this.URL + "/assets/impulses/cabinet/Block%20Inside.wav"
      },
      {
        name: "Vox Custom Bright 4x12 M930 Axis 1",
        url: this.URL + "/assets/impulses/cabinet/voxCustomBrightM930OnAxis1.wav"
      },
      {
        name: "Fender Champ, axis",
        url: this.URL + "/assets/impulses/cabinet/FenderChampAxisStereo.wav"
      },
      {
        name: "Mesa Boogie 4x12",
        url: this.URL + "/assets/impulses/cabinet/Mesa-OS-Rectifier-3.wav"
      },
      {
        name: "001a-SM57-V30-4x12",
        url: this.URL + "/assets/impulses/cabinet/KalthallenCabsIR/001a-SM57-V30-4x12.wav"
      },
      {
        name: "028a-SM7-V30-4x12",
        url: this.URL + "/assets/impulses/cabinet/KalthallenCabsIR/028a-SM7-V30-4x12.wav"
      },
      {
        name: "034a-SM58-V30-4x12",
        url: this.URL + "/assets/impulses/cabinet/KalthallenCabsIR/034a-SM58-V30-4x12.wav"
      },
      {
        name: "022a-MD21-V30-4x12",
        url: this.URL + "/assets/impulses/cabinet/KalthallenCabsIR/022a-MD21-V30-4x12.wav"
      },
      {
        name: "023a-MD21-V30-4x12",
        url: this.URL + "/assets/impulses/cabinet/KalthallenCabsIR/023a-MD21-V30-4x12.wav"
      },
      {
        name: "024a-MD21-G12T75-4x12",
        url: this.URL + "/assets/impulses/cabinet/KalthallenCabsIR/024a-MD21-G12T75-4x12.wav"
      },
      {
        name: "009a-SM57-G12T75-4x12",
        url: this.URL + "/assets/impulses/cabinet/KalthallenCabsIR/009a-SM57-G12T75-4x12.wav"
      }
    ];

    super.setup();
  }

  getPatch(index) {
    return null;
  }

  getParam(key) {
    try {
      return this.params[key];
    } catch (error) {
      console.warn("this plugin does not implement this param");
    }
  }

  setParam(key, value) {
    try {
      this[key] = value;
    } catch (error) {
      console.warn("this plugin does not implement this param");
    }
  }

  onMidi(msg) {
    return msg;
  }
  createNodes() {
    this.equalizer = new EqualizerDisto(this.context);
    this.ampReverb = new ConvolverDisto(
      this.context,
      this.reverbImpulses,
      "reverbImpulses"
    );
    this.cabinetSim = new ConvolverDisto(
      this.context,
      this.cabinetImpulses,
      "cabinetImpulses"
    );
    this.boost = new BoostDisto(this.context);

    this.amp = new AmpDisto(
      this.context,
      this.boost,
      this.equalizer,
      this.ampReverb,
      this.cabinetSim
    );
  }

  connectNodes() {
    this._input.connect(this.amp.input);
    this.amp.output.connect(this._output);
  }

  set volume(val) {
    this.params.volume = val;
    this.amp.changeOutputGain(val);
  }

  set master(val) {
    this.params.master = val;
    this.amp.changeMasterVolume(val);
  }

  set drive(val) {
    this.params.drive = val;
    this.amp.changeDrive(val);
  }

  set bass(val) {
    this.params.bass = val;
    this.amp.changeBassFilterValue(val);
  }

  set middle(val) {
    this.params.middle = val;
    this.amp.changeMidFilterValue(val);
  }

  set treble(val) {
    this.params.treble = val;
    this.amp.changeTrebleFilterValue(val);
  }

  set reverb(val) {
    this.params.reverb = val;
    this.amp.changeReverbGain(val);
  }

  set presence(val) {
    this.params.presence = val;
    this.amp.changePresenceFilterValue(val);
  }

  set status(_sig) {
    let bypassOn = _sig !== "disable";
    this.bypass(bypassOn);

    //this.amp.bypass(bypassOn, this);
  }

  set preset(val) {
    this.params.preset = val;
    this.amp.setPresetByIndex(this, val);
  }

  set LS1Freq(val) {
    this.params.LS1Freq = val;
    this.amp.changeLowShelf1FrequencyValue(val);
  }

  set LS1Gain(val) {
    this.params.LS1Gain = val;
    this.amp.changeLowShelf1GainValue(val);
  }

  set LS2Freq(val) {
    this.params.LS2Freq = val;
    this.amp.changeLowShelf2FrequencyValue(val);
  }

  set LS2Gain(val) {
    this.params.LS2Gain = val;
    this.amp.changeLowShelf2GainValue(val);
  }

  set LS3Freq(val) {
    this.params.LS3Freq = val;
    this.amp.changeLowShelf3FrequencyValue = val;
  }

  set LS3Gain(val) {
    this.params.LS3Gain = val;
    this.amp.changeLowShelf3GainValue(val);
  }
  set gain1(val) {
    this.params.gain1 = val;
    this.amp.changePreampStage1GainValue(val);
  }

  set gain2(val) {
    this.params.gain2 = val;
    this.amp.changePreampStage2GainValue(val);
  }

  set HP1Freq(val) {
    this.params.HP1Freq = val;
    this.amp.changeHighPass1FrequencyValue(val);
  }

  set HP1Q(val) {
    this.params.HP1Q = val;
    this.amp.changeHighPass1QValue(val);
  }

  set EQ(val) {
    this.params.EQ = val;
    this.amp.changeEQValues(val);
  }

  set CG(val) {
    this.params.CG = val;
    this.amp.changeRoom(val);
  }

  bypass(bypassOn) {
    if (!bypassOn) {
      this._input.disconnect();
      this._input.connect(this._output);
      this.params.status = "disable";
    } else {
      this._input.disconnect();
      this._input.connect(this.amp.input);
      this.params.status = "enable";
    }
  }
};

// ----------- AMP ---------------

function AmpDisto(context, boost, eq, reverb, cabinetSim) {
  var presets = [];
  var wsFactoryDisto = new WaveShapersDisto();

  var currentDistoName = "standard";
  var currentK = 2;
  var currentWSCurve = wsFactoryDisto.distorsionCurves[currentDistoName](
    currentK
  );

  var input = context.createGain();
  var output = context.createGain();

  var inputGain = context.createGain();
  inputGain.gain.value = 1;
  var bassFilter, midFilter, trebleFilter, presenceFilter;

  var k = [2, 2, 2, 2];
  var od = [];
  var distoTypes = ["asymetric", "standard"];

  var gainsOds = [];

  var lowShelf1 = context.createBiquadFilter();
  lowShelf1.type = "lowshelf";
  lowShelf1.frequency.value = 720;
  lowShelf1.gain.value = -6;

  var lowShelf2 = context.createBiquadFilter();
  lowShelf2.type = "lowshelf";
  lowShelf2.frequency.value = 320;
  lowShelf2.gain.value = -5;

  var preampStage1Gain = context.createGain();
  preampStage1Gain.gain.value = 1.0;

  od[0] = context.createWaveShaper();
  od[0].curve = wsFactoryDisto.distorsionCurves[distoTypes[0]](0);
  var highPass1 = context.createBiquadFilter();
  highPass1.type = "highpass";
  highPass1.frequency.value = 6;
  highPass1.Q.value = 0.7071;

  var lowShelf3 = context.createBiquadFilter();
  lowShelf3.type = "lowshelf";
  lowShelf3.frequency.value = 720;
  lowShelf3.gain.value = -6;

  var preampStage2Gain = context.createGain();
  preampStage2Gain.gain.value = 1;

  od[1] = context.createWaveShaper();
  od[1].curve = wsFactoryDisto.distorsionCurves[distoTypes[1]](0);

  changeDistorsionValues(4, 0);
  changeDistorsionValues(4, 1);

  var outputGain = context.createGain();
  changeOutputGainValue(7);

  var bassFilter = context.createBiquadFilter();
  bassFilter.frequency.value = 100;
  bassFilter.type = "lowshelf";
  bassFilter.Q.value = 0.7071;

  var midFilter = context.createBiquadFilter();
  midFilter.frequency.value = 1700;
  midFilter.type = "peaking";
  midFilter.Q.value = 0.7071;

  var trebleFilter = context.createBiquadFilter();
  trebleFilter.frequency.value = 6500;
  trebleFilter.type = "highshelf";
  trebleFilter.Q.value = 0.7071;

  var presenceFilter = context.createBiquadFilter();
  presenceFilter.frequency.value = 3900;
  presenceFilter.type = "peaking";
  presenceFilter.Q.value = 0.7071;

  var eqhicut = context.createBiquadFilter();
  eqhicut.frequency.value = 10000;
  eqhicut.type = "peaking";
  eqhicut.gain.value = -25;

  var eqlocut = context.createBiquadFilter();
  eqlocut.frequency.value = 60;
  eqlocut.type = "peaking";
  eqlocut.gain.value = -19;

  var bypassEQg = context.createGain();
  bypassEQg.gain.value = 0;
  var inputEQ = context.createGain();

  var cabinetSim, reverb;
  var masterVolume = context.createGain();
  changeMasterVolume(2);

  doAllConnections();

  function doAllConnections() {
    buildGraph();
    changeRoom(7.5);
    initPresets();
  }

  function buildGraph() {
    input.connect(inputGain);
    inputGain.connect(boost.input);
    boost.output.connect(lowShelf1);
    lowShelf1.connect(lowShelf2);
    lowShelf2.connect(preampStage1Gain);
    preampStage1Gain.connect(od[0]);
    od[0].connect(highPass1);
    highPass1.connect(lowShelf3);

    lowShelf3.connect(preampStage2Gain);
    preampStage2Gain.connect(od[1]);
    od[1].connect(outputGain);

    outputGain.connect(trebleFilter);
    trebleFilter.connect(bassFilter);
    bassFilter.connect(midFilter);
    midFilter.connect(presenceFilter);
    presenceFilter.connect(eqlocut);
    eqlocut.connect(eqhicut);
    eqhicut.connect(inputEQ);
    eqhicut.connect(bypassEQg);
    bypassEQg.connect(masterVolume);

    inputEQ.connect(eq.input);
    eq.output.connect(masterVolume);
    masterVolume.connect(reverb.input);

    reverb.output.connect(cabinetSim.input);
    cabinetSim.output.connect(output);
  }

  function boostOnOff(cb) {
    boost.toggle();
    adjustOutputGainIfBoostActivated();
    updateBoostLedButtonState(boost.isActivated());
  }

  function changeBoost(state) {
    if (boost.isActivated() !== state) {
      boost.onOff(state);
      adjustOutputGainIfBoostActivated();
      updateBoostLedButtonState(boost.isActivated());
    } else {
    }
  }

  function adjustOutputGainIfBoostActivated() {
    if (boost.isActivated()) {
      output.gain.value /= 2;
    } else {
      output.gain.value *= 2;
    }
  }

  function updateBoostLedButtonState(activated) {}

  function changeInputGainValue(sliderVal) {
    input.gain.value = parseFloat(sliderVal);
  }

  function changeOutputGainValue(sliderVal) {
    output.gain.value = parseFloat(sliderVal) / 10;
  }

  function changeLowShelf1FrequencyValue(sliderVal) {
    var value = parseFloat(sliderVal);
    lowShelf1.frequency.value = value;
  }

  function changeLowShelf1GainValue(sliderVal) {
    var value = parseFloat(sliderVal);
    lowShelf1.gain.value = value;
  }

  function changeLowShelf2FrequencyValue(sliderVal) {
    var value = parseFloat(sliderVal);
    lowShelf2.frequency.value = value;
  }

  function changeLowShelf2GainValue(sliderVal) {
    var value = parseFloat(sliderVal);
    lowShelf2.gain.value = value;
  }

  function changePreampStage1GainValue(sliderVal) {
    var value = parseFloat(sliderVal);
    preampStage1Gain.gain.value = value;
  }

  function changeHighPass1FrequencyValue(sliderVal) {
    var value = parseFloat(sliderVal);
    highPass1.frequency.value = value;
  }

  function changeHighPass1QValue(sliderVal) {
    var value = parseFloat(sliderVal);
    highPass1.Q.value = value;
  }

  function changeLowShelf3FrequencyValue(sliderVal) {
    var value = parseFloat(sliderVal);
    lowShelf3.frequency.value = value;
  }

  function changeLowShelf3GainValue(sliderVal) {
    var value = parseFloat(sliderVal);
    lowShelf3.gain.value = value;
  }

  function changePreampStage2GainValue(sliderVal) {
    var value = parseFloat(sliderVal);
    preampStage2Gain.gain.value = value;
  }

  function changeHicutFreqValue(sliderVal) {
    var value = parseFloat(sliderVal);
    for (var i = 0; i < 4; i++) {
      hiCutFilters[i].frequency.value = value;
    }
    var output = document.querySelector("#hiCutFreq");
    output.value = parseFloat(sliderVal).toFixed(1) + " Hz";

    var slider = document.querySelector("#hiCutFreqSlider");
    slider.value = parseFloat(sliderVal).toFixed(1);
  }

  function changeBassFilterValue(sliderVal) {
    var value = parseFloat(sliderVal);
    bassFilter.gain.value = (value - 10) * 7;
  }

  function changeMidFilterValue(sliderVal) {
    var value = parseFloat(sliderVal);
    midFilter.gain.value = (value - 5) * 4;
  }

  function changeTrebleFilterValue(sliderVal) {
    var value = parseFloat(sliderVal);
    trebleFilter.gain.value = (value - 10) * 10;
  }

  function changePresenceFilterValue(sliderVal) {
    var value = parseFloat(sliderVal);
    presenceFilter.gain.value = (value - 5) * 2;
  }

  function buildDistoMenu1() {
    for (var p in wsFactoryDisto.distorsionCurves) {
      var option = document.createElement("option");
      option.value = p;
      option.text = p;
      menuDisto1.appendChild(option);
    }
    menuDisto1.onchange = changeDistoType1;
  }
  function buildDistoMenu2() {
    for (var p in wsFactoryDisto.distorsionCurves) {
      var option = document.createElement("option");
      option.value = p;
      option.text = p;
      menuDisto2.appendChild(option);
    }
    menuDisto2.onchange = changeDistoType2;
  }

  function changeDistoType1() {
    currentDistoName = menuDisto1.value;
    distoTypes[0] = currentDistoName;
    changeDrive(currentK);
  }

  function changeDistoType2() {
    currentDistoName = menuDisto2.value;
    distoTypes[1] = currentDistoName;
    changeDrive(currentK);
  }

  function changeDisto1TypeFromPreset(name) {
    currentDistoName = name;
    distoTypes[0] = currentDistoName;
  }

  function changeDisto2TypeFromPreset(name) {
    currentDistoName = name;
    distoTypes[1] = currentDistoName;
  }

  function changeDrive(sliderValue) {
    for (var i = 0; i < 2; i++) {
      changeDistorsionValues(sliderValue, i);
    }
  }

  function changeDistorsionValues(sliderValue, numDisto) {
    var value = 150 * parseFloat(sliderValue);
    var minp = 0;
    var maxp = 1500;

    var minv = Math.log(10);
    var maxv = Math.log(1500);

    var scale = (maxv - minv) / (maxp - minp);

    value = Math.exp(minv + scale * (value - minp));

    k[numDisto] = value;
    od[numDisto].curve = wsFactoryDisto.distorsionCurves[distoTypes[numDisto]](
      k[numDisto]
    );
    currentWSCurve = od[numDisto].curve;
    var output = document.querySelector("#k" + numDisto);
    var numSlider = numDisto + 1;
    var slider = document.querySelector("#K" + numSlider + "slider");
    var knob = document.querySelector("#Knob3");
    var maxPosVal1 = Math.max(logToPos(k[2]), logToPos(k[3]));
    var maxPosVal2 = Math.max(logToPos(k[0]), logToPos(k[1]));
    var maxPosVal = Math.max(maxPosVal1, maxPosVal2);
    var linearValue = parseFloat(maxPosVal).toFixed(1);
    currentK = linearValue;
  }

  function logToPos(logValue) {
    var minp = 0;
    var maxp = 1500;
    var minv = Math.log(10);
    var maxv = Math.log(1500);
    var scale = (maxv - minv) / (maxp - minp);
    return (minp + (Math.log(logValue) - minv) / scale) / 150;
  }

  function changeOversampling(cb) {
    for (var i = 0; i < 2; i++) {
      if (cb.checked) {
        od[i].oversample = "4x";
        boost.setOversampling("4x");
      } else {
        od[i].oversample = "none";
        boost.setOversampling("none");
      }
    }
  }

  function getDistorsionValue(numChannel) {
    var pos = logToPos(k[numChannel]);
    return parseFloat(pos).toFixed(1);
  }

  function drawDistoCurves(distoDrawer, signalDrawer, curve) {
    var c = curve;
    distoDrawer.clear();
    drawCurve(distoDrawer, c);

    signalDrawer.clear();
    signalDrawer.drawAxis();
    signalDrawer.makeCurve(Math.sin, 0, Math.PI * 2);
    signalDrawer.drawCurve("red", 2);
    var cTransformed = distord(c);
    drawCurve(signalDrawer, cTransformed);
  }

  function distord(c) {
    var curveLength = c.length;

    var c2 = new Float32Array(DRAWER_CANVAS_SIZE);
    var incX = (2 * Math.PI) / DRAWER_CANVAS_SIZE;
    var x = 0;
    for (var i = 0; i < DRAWER_CANVAS_SIZE; i++) {
      var index = map(Math.sin(x), -1, 1, 0, curveLength - 1);
      c2[i] = c[Math.round(index)];
      x += incX;
    }
    return c2;
  }

  function changeQValues(sliderVal, numQ) {
    var value = parseFloat(sliderVal);
    filters[numQ].Q.value = value;

    var output = document.querySelector("#q" + numQ);
    output.value = value.toFixed(1);

    var numSlider = numQ + 1;
    var slider = document.querySelector("#Q" + numSlider + "slider");
    slider.value = value;
  }

  function changeFreqValues(sliderVal, numF) {
    var value = parseFloat(sliderVal);
    filters[numF].frequency.value = value;

    var output = document.querySelector("#freq" + numF);
    output.value = value + " Hz";
    var numSlider = numF + 1;
    var slider = document.querySelector("#F" + numSlider + "slider");
    slider.value = value;
  }

  function changeOutputGain(sliderVal) {
    var value = parseFloat(sliderVal / 10);
    outputGain.gain.value = value;
  }

  function changeInputGain(sliderVal) {
    var value = parseFloat(sliderVal / 10);
    inputGain.gain.value = value;

    var knob = document.querySelector("#Knob1");
    knob.setValue(parseFloat(sliderVal).toFixed(1), false);
  }

  function changeMasterVolume(sliderVal) {
    var value = parseFloat(sliderVal);
    masterVolume.gain.value = value;

    var knob = document.querySelector("#Knob2");
  }

  function changeReverbGain(sliderVal) {
    var value = parseFloat(sliderVal) / 10;
    reverb.setGain(value);
  }

  function changeReverbImpulse(name) {
    reverb.loadImpulseByName(name);
  }

  function changeRoom(sliderVal) {
    var value = parseFloat(sliderVal) / 10;
    cabinetSim.setGain(value);

    var output = document.querySelector("#cabinetGainOutput");
    var slider = document.querySelector("#convolverCabinetSlider");
  }

  function changeCabinetSimImpulse(name) {
    cabinetSim.loadImpulseByName(name);
  }

  function changeEQValues(eqValues) {
    eq.setValues(eqValues);
  }

  function makeDistortionCurve(k) {
    currentWSCurve = wsFactoryDisto.distorsionCurves[currentDistoName](k);
    return currentWSCurve;
  }

  function initPresets() {
    var preset0 = {
      name: "Default",
      boost: false,
      LS1Freq: 720,
      LS1Gain: -6,
      LS2Freq: 320,
      LS2Gain: -6.300000190734863,
      gain1: 3,
      distoName1: "asymetric",
      K1: "3",
      HP1Freq: 6,
      HP1Q: 0.707099974155426,
      LS3Freq: 720,
      LS3Gain: -6,
      gain2: 1,
      distoName2: "crunch",
      K2: "3.0",
      OG: "3.0",
      BF: "3.0",
      MF: "3.0",
      TF: "3.0",
      PF: "3.0",
      EQ: [5, 5, 5, 5, 5, 5],
      MV: "3.0",
      RN: "Fender Hot Rod",
      RG: "3.0",
      CN: "Marshall 1960, axis",
      CG: "3.0",
    };
    presets.push(preset0);

    var preset1 = {
      name: "Jimmy HDX",
      boost: false,
      LS1Freq: 720,
      LS1Gain: -6,
      LS2Freq: 320,
      LS2Gain: -6.300000190734863,
      gain1: 1,
      distoName1: "asymetric",
      K1: "9.4",
      HP1Freq: 6,
      HP1Q: 0.707099974155426,
      LS3Freq: 720,
      LS3Gain: -6,
      gain2: 1,
      distoName2: "crunch",
      K2: "9.4",
      OG: "8.9",
      BF: "4.5",
      MF: "4.0",
      TF: "6.0",
      PF: "9.0",
      EQ: [4, 13, -8, -8, 15, 12],
      MV: "3.7",
      RN: "Fender Hot Rod",
      RG: "1.1",
      CN: "Marshall 1960, axis",
      CG: "4.5",
    };
    presets.push(preset1);

    var preset2 = {
      name: "Pete Townshend",
      boost: false,
      LS1Freq: 720,
      LS1Gain: -6,
      LS2Freq: 361,
      LS2Gain: 1.600000023841858,
      gain1: 1.159999966621399,
      distoName1: "clean",
      K1: "3.5",
      HP1Freq: 6,
      HP1Q: 3.3970000743865967,
      LS3Freq: 720,
      LS3Gain: -6,
      gain2: 2.9600000381469727,
      distoName2: "standardLower",
      K2: "3.5",
      OG: "7.1",
      BF: "6.7",
      MF: "7.1",
      TF: "3.2",
      PF: "5.0",
      EQ: [10, 5, -7, -7, 12, 0],
      MV: 7.333333333333334,
      RN: "Fender Hot Rod",
      RG: "1.4",
      CN: "Mesa Boogie 4x12",
      CG: "8.8",
      PREAMP_BEFORE_TONESTACK: false,
      PREAMP_EXTRA_STAGES: [{ type: "clean", k: "3.2" }],
      PA_ENABLED: false,
      PA_LO_HI_CUT_FILTERS_ENABLED: true,
      PA_DISTORSION_CURVE: "clean",
      PA_K: "0.0",
      PA_NEGATIVE_GAIN: -0.4000000059604645,
      PA_PRESENCE_GAIN_RANGE: 4,
      PA_PRESENCE_FILTERS_PARAMS: [
        { Q: 0.000009999999747378752, frequency: 40, gain: 12 },
        { Q: 0, frequency: 80, gain: 0 },
        { Q: 1, frequency: 230, gain: 0 },
        { Q: 1, frequency: 2000, gain: 1.5199999809265137 },
        { Q: 1, frequency: 4000, gain: 1.5199999809265137 },
        { Q: 1, frequency: 10000, gain: 0 },
        { Q: 0.000009999999747378752, frequency: 18000, gain: 12 },
      ],
      PA_BOOST_GAIN: 2.999999761581421,
    };
    presets.push(preset2);

    var preset3 = {
      name: "Metal",
      boost: false,
      LS1Freq: 720,
      LS1Gain: -6,
      LS2Freq: 320,
      LS2Gain: -10.199999809265137,
      gain1: 1,
      distoName1: "notSoDistorded",
      K1: "8",
      HP1Freq: 6,
      HP1Q: 0.707099974155426,
      LS3Freq: 720,
      LS3Gain: -6,
      gain2: 1,
      distoName2: "vertical",
      K2: "8",
      OG: "1.8",
      BF: "8.7",
      MF: "7.6",
      TF: "3.8",
      PF: "9.4",
      EQ: [19, 8, -6, -10, 7, 2],
      MV: "2.8",
      RN: "Fender Hot Rod",
      RG: "0.7",
      CN: "Marshall 1960, axis",
      CG: "1.5",
    };
    presets.push(preset3);

    var preset4 = {
      name: "Hard Rock Classic 1",
      boost: false,
      LS1Freq: 720,
      LS1Gain: -6,
      LS2Freq: 320,
      LS2Gain: -5,
      gain1: 1,
      distoName1: "asymetric",
      K1: "7.8",
      HP1Freq: 6,
      HP1Q: 0.707099974155426,
      LS3Freq: 720,
      LS3Gain: -6,
      gain2: 1,
      distoName2: "notSoDistorded",
      K2: "7.8",
      OG: "10.0",
      BF: "8.2",
      MF: "8.2",
      TF: "3.8",
      PF: "6.9",
      EQ: [5, 11, -6, -10, 7, 2],
      MV: 10,
      RN: "Fender Hot Rod",
      RG: "2.0",
      CN: "Marshall 1960, axis",
      CG: "9.4",
      PREAMP_BEFORE_TONESTACK: true,
      PREAMP_EXTRA_STAGES: [],
      PA_ENABLED: false,
      PA_LO_HI_CUT_FILTERS_ENABLED: true,
      PA_DISTORSION_CURVE: "clean",
      PA_K: "0.0",
      PA_NEGATIVE_GAIN: -0.4000000059604645,
      PA_PRESENCE_GAIN_RANGE: 4,
      PA_PRESENCE_FILTERS_PARAMS: [
        { Q: 0.000009999999747378752, frequency: 40, gain: 12 },
        { Q: 0, frequency: 80, gain: 0 },
        { Q: 1, frequency: 230, gain: 0 },
        { Q: 1, frequency: 2000, gain: 0.800000011920929 },
        { Q: 1, frequency: 4000, gain: 0.800000011920929 },
        { Q: 1, frequency: 10000, gain: 0 },
        { Q: 0.000009999999747378752, frequency: 18000, gain: 12 },
      ],
      PA_BOOST_GAIN: 2.8999998569488525,
    };
    presets.push(preset4);

    var preset5 = {
      name: "HARD ROCK CLASSIC 2",
      boost: false,
      LS1Freq: 720,
      LS1Gain: -6,
      LS2Freq: 320,
      LS2Gain: -10.199999809265137,
      gain1: 1,
      distoName1: "standard",
      K1: "5.2",
      HP1Freq: 6,
      HP1Q: 0.707099974155426,
      LS3Freq: 720,
      LS3Gain: -6,
      gain2: 1,
      distoName2: "notSoDistorded",
      K2: "5.1",
      OG: "10.0",
      BF: "8.7",
      MF: "8.0",
      TF: "3.8",
      PF: "9.4",
      EQ: [12, 8, -6, -10, 7, 2],
      MV: 10,
      RN: "Fender Hot Rod",
      RG: "0.7",
      CN: "Marshall 1960, axis",
      CG: "9.2",
      PREAMP_BEFORE_TONESTACK: true,
      PREAMP_EXTRA_STAGES: [],
      PA_ENABLED: false,
      PA_LO_HI_CUT_FILTERS_ENABLED: true,
      PA_DISTORSION_CURVE: "clean",
      PA_K: "0.0",
      PA_NEGATIVE_GAIN: -0.4000000059604645,
      PA_PRESENCE_GAIN_RANGE: 4,
      PA_PRESENCE_FILTERS_PARAMS: [
        { Q: 0.000009999999747378752, frequency: 40, gain: 12 },
        { Q: 0, frequency: 80, gain: 0 },
        { Q: 1, frequency: 230, gain: 0 },
        { Q: 1, frequency: 2000, gain: 0.800000011920929 },
        { Q: 1, frequency: 4000, gain: 0.800000011920929 },
        { Q: 1, frequency: 10000, gain: 0 },
        { Q: 0.000009999999747378752, frequency: 18000, gain: 12 },
      ],
      PA_BOOST_GAIN: 2.8999998569488525,
    };
    presets.push(preset5);

    var preset6 = {
      name: "Clean and Warm",
      boost: false,
      LS1Freq: 720,
      LS1Gain: -6,
      LS2Freq: 320,
      LS2Gain: 1.600000023841858,
      gain1: 1,
      distoName1: "asymetric",
      K1: "7.8",
      HP1Freq: 6,
      HP1Q: 0.707099974155426,
      LS3Freq: 720,
      LS3Gain: -6,
      gain2: 1,
      distoName2: "standard",
      K2: "0.9",
      OG: "3.0",
      BF: "6.7",
      MF: "4.7",
      TF: "3.2",
      PF: "6.9",
      EQ: [10, 5, -7, -7, 16, 0],
      MV: "7.2",
      RN: "Fender Hot Rod",
      RG: "1.4",
      CN: "Marshall 1960, axis",
      CG: "8.8",
    };
    presets.push(preset6);

    var preset7 = {
      name: "Strong and Warm",
      boost: false,
      LS1Freq: 720,
      LS1Gain: -6,
      LS2Freq: 320,
      LS2Gain: -1,
      gain1: 1.0299999713897705,
      distoName1: "asymetric",
      K1: "7.8",
      HP1Freq: 6,
      HP1Q: 0.707099974155426,
      LS3Freq: 720,
      LS3Gain: -6,
      gain2: 1,
      distoName2: "superClean",
      K2: "7.8",
      OG: "7.0",
      BF: "8.2",
      MF: "6.7",
      TF: "5.0",
      PF: "6.9",
      EQ: [0, 0, 0, -1, 0, 1],
      MV: "5.9",
      RN: "Fender Hot Rod",
      RG: "1.1",
      CN: "Vox Custom Bright 4x12 M930 Axis 1",
      CG: "8.0",
    };
    presets.push(preset7);

    var preset8 = {
      name: "Another Clean Sound",
      boost: false,
      LS1Freq: 720,
      LS1Gain: -6,
      LS2Freq: 320,
      LS2Gain: -6.300000190734863,
      gain1: 1,
      distoName1: "asymetric",
      K1: "6.4",
      HP1Freq: 6,
      HP1Q: 0.707099974155426,
      LS3Freq: 720,
      LS3Gain: -6,
      gain2: 1,
      distoName2: "crunch",
      K2: "6.4",
      OG: "7.0",
      BF: "6.7",
      MF: "5.0",
      TF: "5.0",
      PF: "8.9",
      EQ: [4, 13, -8, -8, 15, 12],
      MV: "3.7",
      RN: "Fender Hot Rod",
      RG: "2",
      CN: "Marshall 1960, axis",
      CG: "4.5",
    };
    presets.push(preset8);
    var preset9 = {
      name: "Hard Rock Classic 3",
      boost: false,
      LS1Freq: 720,
      LS1Gain: -6,
      LS2Freq: 320,
      LS2Gain: -10.199999809265137,
      gain1: 1,
      distoName1: "standard",
      K1: "5.2",
      HP1Freq: 6,
      HP1Q: 0.707099974155426,
      LS3Freq: 720,
      LS3Gain: -6,
      gain2: 1,
      distoName2: "notSoDistorded",
      K2: "5.1",
      OG: "2.7",
      BF: "8.7",
      MF: "8.0",
      TF: "3.8",
      PF: "9.4",
      EQ: [19, 8, -6, -10, 7, 2],
      MV: "5.5",
      RN: "Fender Hot Rod",
      RG: "0.7",
      CN: "Marshall 1960, axis",
      CG: "9.2",
    };
    presets.push(preset9);
    var preset10 = {
      name: "TEST",
      boost: false,
      LS1Freq: 720,
      LS1Gain: -6,
      LS2Freq: 320,
      LS2Gain: -5,
      gain1: 1,
      distoName1: "asymetric",
      K1: "7.8",
      HP1Freq: 6,
      HP1Q: 0.707099974155426,
      LS3Freq: 720,
      LS3Gain: -6,
      gain2: 1,
      distoName2: "notSoDistorded",
      K2: "7.8",
      OG: "10.0",
      BF: "8.2",
      MF: "8.2",
      TF: "3.8",
      PF: "6.9",
      EQ: [5, 11, -6, -10, 7, 2],
      MV: 10,
      RN: "Fender Hot Rod",
      RG: "2.0",
      CN: "Marshall 1960, axis",
      CG: "9.4",
      PREAMP_BEFORE_TONESTACK: true,
      PREAMP_EXTRA_STAGES: [],
      PA_ENABLED: false,
      PA_LO_HI_CUT_FILTERS_ENABLED: true,
      PA_DISTORSION_CURVE: "clean",
      PA_K: "0.0",
      PA_NEGATIVE_GAIN: -0.4000000059604645,
      PA_PRESENCE_GAIN_RANGE: 4,
      PA_PRESENCE_FILTERS_PARAMS: [
        { Q: 0.000009999999747378752, frequency: 40, gain: 12 },
        { Q: 0, frequency: 80, gain: 0 },
        { Q: 1, frequency: 230, gain: 0 },
        { Q: 1, frequency: 2000, gain: 0.800000011920929 },
        { Q: 1, frequency: 4000, gain: 0.800000011920929 },
        { Q: 1, frequency: 10000, gain: 0 },
        { Q: 0.000009999999747378752, frequency: 18000, gain: 12 },
      ],
      PA_BOOST_GAIN: 2.8999998569488525,
    };
    presets.push(preset10);
  }

  function setPresetByIndex(parent, index) {
    setPreset(parent, presets[index]);
  }

  function setPreset(parent, p) {
    if (p.distoName1 === undefined) {
      p.distoName1 = "standard";
    }
    if (p.distoName2 === undefined) {
      p.distoName2 = "standard";
    }

    if (p.boost === undefined) p.boost = false;
    changeBoost(p.boost);

    changeLowShelf1FrequencyValue(p.LS1Freq);
    changeLowShelf1GainValue(p.LS1Gain);
    changeLowShelf2FrequencyValue(p.LS2Freq);
    changeLowShelf2GainValue(p.LS2Gain);
    changePreampStage1GainValue(p.gain1);
    changeDisto1TypeFromPreset(p.distoName1);
    changeDistorsionValues(p.K1, 0);

    changeLowShelf3FrequencyValue(p.LS3Freq);
    changeLowShelf3GainValue(p.LS3Gain);
    changePreampStage2GainValue(p.gain2);
    changeDisto2TypeFromPreset(p.distoName2);
    changeDistorsionValues(p.K2, 1);

    parent.volume = p.OG;
    parent.bass = p.BF;
    parent.middle = p.MF;
    parent.treble = p.TF;
    parent.presence = p.PF;
    parent.master = p.MV;
    parent.reverb = p.RG;
    parent.drive = p.K1;

    parent.LS1Freq = p.LS1Freq;
    parent.LS1Gain = p.LS1Gain;
    parent.LS2Freq = p.LS2Freq;
    parent.LS2Gain = p.LS2Gain;
    parent.LS3Freq = p.LS3Freq;
    parent.LS3Gain = p.LS3Gain;
    parent.gain1 = p.gain1;
    parent.gain2 = p.gain2;
    parent.HP1Freq = p.HP1Freq;
    parent.HP1Q = p.HP1Q;
    parent.EQ = p.EQ;
    parent.boost = p.boost;
    parent.distoName1 = p.distoName1;
    parent.distoName2 = p.distoName2;
    parent.CG = p.CG;

    changeReverbImpulse(p.RN);

    changeRoom(p.CG);
    changeCabinetSimImpulse(p.CN);

    changeEQValues(p.EQ);
    try {
      parent.gui.setAttribute("state", JSON.stringify(parent.params));
    } catch (error) {}
  }

  function getPresets() {
    return presets;
  }

  function setDefaultPreset() {
    setPreset(preset0);
  }

  function printCurrentAmpValues() {
    var currentPresetValue = {
      name: "current",

      boost: boost.isActivated(),

      LS1Freq: lowShelf1.frequency.value,
      LS1Gain: lowShelf1.gain.value,
      LS2Freq: lowShelf2.frequency.value,
      LS2Gain: lowShelf2.gain.value,
      gain1: preampStage1Gain.gain.value,
      distoName1: menuDisto1.value,
      K1: getDistorsionValue(0),
      HP1Freq: highPass1.frequency.value,
      HP1Q: highPass1.Q.value,

      LS3Freq: lowShelf3.frequency.value,
      LS3Gain: lowShelf3.gain.value,
      gain2: preampStage2Gain.gain.value,
      distoName2: menuDisto2.value,
      K2: getDistorsionValue(1),

      OG: (output.gain.value * 10).toFixed(1),
      BF: (bassFilter.gain.value / 7 + 10).toFixed(1),
      MF: (midFilter.gain.value / 4 + 5).toFixed(1),
      TF: (trebleFilter.gain.value / 10 + 10).toFixed(1),
      PF: (presenceFilter.gain.value / 2 + 5).toFixed(1),
      EQ: eq.getValues(),
      MV: masterVolume.gain.value.toFixed(1),
      RN: reverb.getName(),
      RG: (reverb.getGain() * 10).toFixed(1),
      CN: cabinetSim.getName(),
      CG: (cabinetSim.getGain() * 10).toFixed(1),
    };
  }

  function bypass(bypassOn, amp) {
    if (!bypassOn) {
      input.disconnect();
      input.connect(output);
      amp.params.status = "disable";
    } else {
      input.disconnect();
      input.connect(inputGain);
      amp.params.status = "enable";
    }
  }

  function bypassEQ(cb) {
    if (cb.checked) {
      inputEQ.gain.value = 1;
      bypassEQg.gain.value = 0;
    } else {
      inputEQ.gain.value = 0;
      bypassEQg.gain.value = 1;
    }
  }

  return {
    input: input,
    output: output,
    boostOnOff: boostOnOff,
    eq: eq,
    reverb: reverb,
    cabinet: cabinetSim,
    changeInputGainValue: changeInputGainValue,
    changeOutputGainValue: changeOutputGainValue,

    changeLowShelf1FrequencyValue: changeLowShelf1FrequencyValue,
    changeLowShelf1GainValue: changeLowShelf1GainValue,
    changeLowShelf2FrequencyValue: changeLowShelf2FrequencyValue,
    changeLowShelf2GainValue: changeLowShelf2GainValue,
    changePreampStage1GainValue: changePreampStage1GainValue,
    changeHighPass1FrequencyValue: changeHighPass1FrequencyValue,
    changeHighPass1QValue: changeHighPass1QValue,
    changeLowShelf3FrequencyValue: changeLowShelf3FrequencyValue,
    changeLowShelf3GainValue: changeLowShelf3GainValue,
    changePreampStage2GainValue: changePreampStage2GainValue,

    changeBassFilterValue: changeBassFilterValue,
    changeMidFilterValue: changeMidFilterValue,
    changeTrebleFilterValue: changeTrebleFilterValue,
    changePresenceFilterValue: changePresenceFilterValue,
    changeDrive: changeDrive,
    changeDistorsionValues: changeDistorsionValues,
    changeOversampling: changeOversampling,
    changeOutputGain: changeOutputGain,
    changeInputGain: changeInputGain,

    changeMasterVolume: changeMasterVolume,
    changeReverbGain: changeReverbGain,
    changeRoom: changeRoom,
    changeEQValues: changeEQValues,
    setDefaultPreset: setDefaultPreset,
    getPresets: getPresets,
    setPreset: setPreset,
    setPresetByIndex: setPresetByIndex,
    printCurrentAmpValues: printCurrentAmpValues,
    bypass: bypass,
    bypassEQ: bypassEQ,
  };
}

function EqualizerDisto(ctx) {
  var filters = [];

  [60, 170, 350, 1000, 3500, 10000].forEach(function (freq, i) {
    var eq = ctx.createBiquadFilter();
    eq.frequency.value = freq;
    eq.type = "peaking";
    eq.gain.value = 0;
    filters.push(eq);
  });

  for (var i = 0; i < filters.length - 1; i++) {
    filters[i].connect(filters[i + 1]);
  }

  function changeGain(sliderVal, nbFilter) {
    var value = parseFloat(sliderVal);
    filters[nbFilter].gain.value = value;
  }

  function setValues(values) {
    values.forEach(function (val, index) {
      changeGain(val, index);
    });
  }

  function getValues() {
    var values = [];
    filters.forEach(function (f, index) {
      values.push(f.gain.value);
    });
    return values;
  }

  return {
    input: filters[0],
    output: filters[filters.length - 1],
    setValues: setValues,
    getValues: getValues,
    changeGain: changeGain,
  };
}

function ConvolverDisto(context, impulses, menuId) {
  var convolverNode, convolverGain, directGain;
  var inputGain = context.createGain();
  var outputGain = context.createGain();
  var decodedImpulse;

  var menuIRs;
  var IRs = impulses;

  var currentImpulse = IRs[0];
  var defaultImpulseURL = IRs[0].url;

  convolverNode = context.createConvolver();
  convolverNode.buffer = decodedImpulse;

  convolverGain = context.createGain();
  convolverGain.gain.value = 0;

  directGain = context.createGain();
  directGain.gain.value = 1;

  buildAudioGraphConvolver();
  setGain(0.2);
  loadImpulseByUrl(defaultImpulseURL);

  function loadSample(audioContext, url) {
    return new Promise(function (resolve, reject) {
      fetch(url)
        .then((response) => {
          return response.arrayBuffer();
        })
        .then((buffer) => {
          audioContext.decodeAudioData(buffer, (decodedAudioData) => {
            resolve(decodedAudioData);
          });
        });
    });
  }

  function loadImpulseByUrl(url) {
    const samples = Promise.all([loadSample(context, url)]).then(setImpulse);
  }

  function loadImpulseByName(name) {
    if (name === undefined) {
      name = IRs[0].name;
    }

    var url = "none";
    for (var i = 0; i < IRs.length; i++) {
      if (IRs[i].name === name) {
        url = IRs[i].url;
        currentImpulse = IRs[i];
        break;
      }
    }
    if (url === "none") {
    } else {
      loadImpulseByUrl(url);
    }
  }

  function setImpulse(param) {
    inputGain.gain.value =0;
    convolverNode.buffer = param[0];
    inputGain.gain.linearRampToValueAtTime(1, context.currentTime+1);
  }

  function buildAudioGraphConvolver() {
    inputGain.connect(directGain);
    directGain.connect(outputGain);

    inputGain.connect(convolverNode);
    convolverNode.connect(convolverGain);
    convolverGain.connect(outputGain);
  }

  function setGain(value) {
    var v1 = Math.cos((value * Math.PI) / 2);
    var v2 = Math.cos(((1 - value) * Math.PI) / 2);

    directGain.gain.value = v1;
    convolverGain.gain.value = v2;
  }

  function getGain() {
    return (2 * Math.acos(directGain.gain.value)) / Math.PI;
  }

  function getName() {
    return currentImpulse.name;
  }
  return {
    input: inputGain,
    output: outputGain,
    setGain: setGain,
    getGain: getGain,
    getName: getName,
    loadImpulseByName: loadImpulseByName,
  };
}

var BoostDisto = function (context) {
  var activated = false;

  var input = context.createGain();
  var inputGain = context.createGain();
  inputGain.gain.value = 0;
  var byPass = context.createGain();
  byPass.gain.value = 1;
  var filter = context.createBiquadFilter();
  filter.frequency.value = 3317;
  var shaper = context.createWaveShaper();
  shaper.curve = makeDistortionCurve(640);
  var outputGain = context.createGain();
  outputGain.gain.value = 2;
  var output = context.createGain();
  input.connect(inputGain);
  inputGain.connect(shaper);
  shaper.connect(filter);
  filter.connect(outputGain);
  outputGain.connect(output);

  input.connect(byPass);
  byPass.connect(output);

  function isActivated() {
    return activated;
  }

  function onOff(wantedState) {
    if (wantedState === undefined) {
      if (activated) toggle();
      return;
    }
    var currentState = activated;

    if (wantedState !== currentState) {
      toggle();
    }
  }

  function toggle() {
    if (!activated) {
      byPass.gain.value = 0;
      inputGain.gain.value = 1;
    } else {
      byPass.gain.value = 1;
      inputGain.gain.value = 0;
    }
    activated = !activated;
  }

  function setOversampling(value) {
    shaper.oversample = value;
  }

  function makeDistortionCurve(k) {
    var n_samples = 44100;
    var curve = new Float32Array(n_samples);
    var deg = Math.PI / 180;
    for (var i = 0; i < n_samples; i += 1) {
      var x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }
  return {
    input: input,
    output: output,
    onOff: onOff,
    toggle: toggle,
    isActivated: isActivated,
    setOversampling: setOversampling,
  };
};

function WaveShapersDisto() {
  var distorsionCurves = {};

  buildDistorsionFactories();

  function buildDistorsionFactories() {
    distorsionCurves.standard = function (distorsionValue) {
      var k = distorsionValue;
      var c = classicDistorsion(k);
      return c;
    };

    distorsionCurves.standardLower = function (distorsionValue) {
      var k = distorsionValue;
      var c = classicDistorsion2(k);
      return c;
    };

    distorsionCurves.smooth = function (distorsionValue) {
      var c = new Float32Array(44100);
      var kTuna = distorsionValue / 1500;
      smooth(kTuna, 44100, c);
      return c;
    };

    distorsionCurves.fuzz = function (distorsionValue) {
      var c = new Float32Array(44100);
      var kTuna = distorsionValue / 1500;
      fuzz(kTuna, 44100, c);
      return c;
    };

    distorsionCurves.clean = function (distorsionValue) {
      var c = new Float32Array(44100);
      var kTuna = distorsionValue / 1500;
      clean(kTuna, 44100, c);
      return c;
    };

    distorsionCurves.asymetric = function (distorsionValue) {
      var c = new Float32Array(44100);
      var kTuna = distorsionValue / 1500;
      asymetric(kTuna, 44100, c);
      return c;
    };

    distorsionCurves.bezier = function (distorsionValue) {
      var k = distorsionValue;
      var c = getBezierCurve();
      return c;
    };

    distorsionCurves.notSoDistorded = function (distorsionValue) {
      var k = distorsionValue / 150;
      var c = notSoDistorded(k);
      return c;
    };

    distorsionCurves.crunch = function (distorsionValue) {
      var k = distorsionValue / 150;
      var c = crunch(k);
      return c;
    };

    distorsionCurves.ClassA = function (distorsionValue) {
      var k = distorsionValue / 150;
      var c = classA(k);
      return c;
    };

    distorsionCurves.superClean = function (distorsionValue) {
      var k = distorsionValue / 150;
      var c = superClean(k);
      return c;
    };

    distorsionCurves.vertical = function (distorsionValue) {
      var k = distorsionValue / 150;
      var c = vertical(k);
      return c;
    };

    distorsionCurves.superFuzz = function (distorsionValue) {
      var k = distorsionValue / 150;
      var c = superFuzz(k);
      return c;
    };

    distorsionCurves.NoisyHiGain = function (distorsionValue) {
      var k = distorsionValue / 10;
      var c = NoisyHiGain(k);
      return c;
    };

    distorsionCurves.HiGainModern = function (distorsionValue) {
      var k = distorsionValue / 2;
      var c = HiGainModern(k);
      return c;
    };
  }

  function classicDistorsion(k) {
    var n_samples = 44100,
      curve = new Float32Array(n_samples),
      deg = Math.PI / 180,
      i = 0,
      x;

    for (; i < n_samples; ++i) {
      x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 57 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  function classicDistorsion2(k) {
    var n_samples = 44100,
      curve = new Float32Array(n_samples),
      deg = Math.PI / 180,
      i = 0,
      x;

    for (; i < n_samples; ++i) {
      x = (i * 2) / n_samples - 1;
      curve[i] = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    }
    return curve;
  }

  function smooth(amount, n_samples, ws_table) {
    amount = Math.min(amount, 0.9);
    var k = (2 * amount) / (1 - amount),
      i,
      x;
    for (i = 0; i < n_samples; i++) {
      x = (i * 2) / n_samples - 1;
      ws_table[i] = ((1 + k) * x) / (1 + k * Math.abs(x));
    }
  }

  function fuzz(amount, n_samples, ws_table) {
    var i,
      x,
      y,
      a = 1 - amount;
    for (i = 0; i < n_samples; i++) {
      x = (i * 2) / n_samples - 1;
      y = x < 0 ? -Math.pow(Math.abs(x), a + 0.04) : Math.pow(x, a);
      ws_table[i] = tanh(y * 2);
    }
  }
  function clean(amount, n_samples, ws_table) {
    var i,
      x,
      y,
      abx,
      a = 1 - amount > 0.99 ? 0.99 : 1 - amount;
    for (i = 0; i < n_samples; i++) {
      x = (i * 2) / n_samples - 1;
      abx = Math.abs(x);
      if (abx < a) y = abx;
      else if (abx > a)
        y = a + (abx - a) / (1 + Math.pow((abx - a) / (1 - a), 2));
      else if (abx > 1) y = abx;
      ws_table[i] = sign(x) * y * (1 / ((a + 1) / 2));
    }
  }

  function asymetric(amount, n_samples, ws_table) {
    var i, x;
    for (i = 0; i < n_samples; i++) {
      x = (i * 2) / n_samples - 1;
      if (x < -0.08905) {
        ws_table[i] =
          (-3 / 4) *
            (1 -
              Math.pow(1 - (Math.abs(x) - 0.032857), 12) +
              (1 / 3) * (Math.abs(x) - 0.032847)) +
          0.01;
      } else if (x >= -0.08905 && x < 0.320018) {
        ws_table[i] = -6.153 * (x * x) + 3.9375 * x;
      } else {
        ws_table[i] = 0.630035;
      }
    }
  }

  function notSoDistorded(a) {
    a = Math.pow(a + 2, 3);
    for (var c = new Float32Array(22050), d = 0; 22050 > d; d += 1) {
      var f = (2 * d) / 22050 - 1;
      c[d] = ((1 + a) * f) / (1 + a * Math.abs(f));
    }
    return c;
  }

  function crunch(a) {
    a = Math.pow(a, 2);
    for (var c = new Float32Array(22050), d = 0; 22050 > d; d += 1) {
      var f = (2 * d) / 22050 - 1;
      c[d] = ((1 + a) * f) / (1 + a * Math.abs(f));
    }
    return c;
  }

  function classA(a) {
    var c = new Float32Array(22050);
    a = 10 + 3 * a;
    for (var d = 0; 22050 > d; d += 1) {
      var e = (2 * d) / 22050 - 1;
      c[d] = ((1 + a) * e) / (1 + a * Math.abs(e));
    }
    return c;
  }

  function superClean(a) {
    a = (a + 6) / 4;
    for (var c = new Float32Array(22050), d = 0; 22050 > d; d += 1) {
      var e = (2 * d) / 22050 - 1;
      c[d] = ((1 + a) * e) / (1 + a * Math.abs(e));
    }
    return c;
  }

  function vertical(a) {
    a = Math.pow(a + 2, 3);
    for (var c = new Float32Array(22050), d = 0; 22050 > d; d += 1) {
      var e = (2 * d) / 22050 - 1;
      c[d] = ((1 + a) * e) / (1 + a * Math.abs(e));
    }
    return c;
  }

  function superFuzz(a) {
    a = Math.pow(a, 3);
    for (var c = new Float32Array(22050), d = 0; 22050 > d; d += 1) {
      var e = (2 * d) / 22050 - 1;
      c[d] = ((1 + a) * e) / (1 + a * Math.abs(e));
    }
    return c;
  }

  function NoisyHiGain(a) {
    a /= 153;
    for (var c = new Float32Array(22050), d = 0; 22050 > d; d += 1)
      c[d] = (0 > (2 * d) / 22050 - 1 ? -1 : 1) * a;
    return c;
  }

  function HiGainModern(a) {
    a = 1 / (1 + Math.pow(a, 4));
    for (var c = new Float32Array(22050), d = 0; 22050 > d; d += 1) {
      var e = (2 * d) / 22050 - 1;
      c[d] = e / (Math.abs(e) + a);
    }
    return c;
  }

  function bezier(t, p0, p1, p2, p3) {
    var cX = 3 * (p1.x - p0.x),
      bX = 3 * (p2.x - p1.x) - cX,
      aX = p3.x - p0.x - cX - bX;

    var cY = 3 * (p1.y - p0.y),
      bY = 3 * (p2.y - p1.y) - cY,
      aY = p3.y - p0.y - cY - bY;

    var x = aX * Math.pow(t, 3) + bX * Math.pow(t, 2) + cX * t + p0.x;
    var y = aY * Math.pow(t, 3) + bY * Math.pow(t, 2) + cY * t + p0.y;

    return { x: x, y: y };
  }

  function getBezierCurve() {
    var p0 = { x: 0, y: 100 };
    var p1 = { x: 10, y: 50 };
    var p2 = { x: 0, y: 50 };
    var p3 = { x: 100, y: 0 };

    var n_samples = 44100,
      accuracy = 1 / n_samples,
      curve = new Float32Array(n_samples),
      index = 0;

    curve[index++] = map(p0.y, 0, 100, 1, -1);

    //
    for (var i = 0; i < 1; i += accuracy) {
      var p = bezier(i, p0, p1, p2, p3);
      curve[index++] = map(p.y, 0, 100, 1, -1);
    }

    return curve;
  }

  return {
    buildDistorsionFactories: buildDistorsionFactories,
    distorsionCurves: distorsionCurves,
  };
}

function tanh(n) {
  return (Math.exp(n) - Math.exp(-n)) / (Math.exp(n) + Math.exp(-n));
}

function sign(x) {
  if (x === 0) {
    return 1;
  } else {
    return Math.abs(x) / x;
  }
}

window.WasabiDistoMachineFull = class WasabiDistoMachineFull extends WebAudioPluginFactory {
  constructor(context, baseUrl, options) {
    super(context, baseUrl, options);
  }
};

AudioContext.prototype.createWasabiDistoMachineFullCompositeNode = OfflineAudioContext.prototype.createWasabiDistoMachineFullCompositeNode = function (
  options
) {
  return new DistoMachineFull(this, options);
};
