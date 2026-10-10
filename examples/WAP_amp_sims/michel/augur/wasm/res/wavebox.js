var Wavebox = function (canvas, index)
{
  var gctx;
  var wave;
  this.index = index;
  this.elem = canvas;
  canvas.box = this;

  let dpr = window.devicePixelRatio || 1;
  canvas.W = 47; // canvas.clientWidth;
  canvas.H = 25; // canvas.clientHeight;
  canvas.style.width  = canvas.W;	canvas.width  = canvas.W * dpr;
  canvas.style.height = canvas.H;	canvas.height = canvas.H * dpr;
  gctx = canvas.getContext("2d");
  gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  gctx.lineWidth = 1;

  Object.defineProperties(this, {
    wave: { set: (w) => { wave = w; update(); }},
    selected: { set: (s) => {
      let p = canvas.parentElement;
      if (s) p.classList.add("selected");
      else   p.classList.remove("selected");
    }}
  });

  function update () {
    var h2 = canvas.H / 2;
    gctx.clearRect(0, 0, canvas.W, canvas.H);
    gctx.strokeStyle = "#555";
    gctx.beginPath();
    gctx.moveTo(0, h2);
    gctx.lineTo(canvas.W, h2);
    gctx.stroke();

    gctx.strokeStyle = "steelblue";
    gctx.moveTo(3, h2);
    gctx.beginPath();

    var n = 0;
    var N = canvas.W - 3;
    var spp = wave.length / (canvas.W - 6);
    for (var x=3; x<=N; x++) {
      y = wave[n|0];
      gctx.lineTo(x, h2 - y * h2 * 0.83);
      n += spp;
      if (n >= wave.length) n = wave.length - 1;
    }
    gctx.stroke();
  }
}

var Spectbox = function (canvas)
{
  var gctx;
  var data;

  let dpr = window.devicePixelRatio || 1;
  canvas.W = canvas.clientWidth;
  canvas.H = canvas.clientHeight;
  canvas.style.width  = canvas.W;	canvas.width  = canvas.W * dpr;
  canvas.style.height = canvas.H;	canvas.height = canvas.H * dpr;
  gctx = canvas.getContext("2d");
  gctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  gctx.lineWidth = 1;

  Object.defineProperties(this, {
    data: { set: (w) => { data = w; update(); }}
  });

  function update () {
    var h = canvas.H - 5;
    gctx.clearRect(0, 0, canvas.W, canvas.H);
    gctx.strokeStyle = "#555";
    gctx.beginPath();
    gctx.moveTo(3, h);
    gctx.lineTo(canvas.W-3, h);
    gctx.stroke();

    gctx.strokeStyle = "steelblue";

    let x = 3;
    for (var n=0; n<data.length; n++) {
      let y = canvas.H - (1 + data[n]) * h * 0.99;
      if (y < h) {
        gctx.beginPath();
        gctx.moveTo(x, h);
        gctx.lineTo(x, y);
        gctx.stroke();
      }
      x += 1;
    }
  }
}
