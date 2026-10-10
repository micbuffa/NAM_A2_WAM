var EG = function (svg, isamp) {
  var levels = [0,0,0,50,0];
  var rates  = [0,50,50,50,50];
  var points = [];
  var lines  = [];
  var susline,suslen = 30;
  var x0 = 12;
  var y0 = 113;
  var r = 8;
  var hsegment = 100;
  var wsegment = 100;
  var curpoint;
  var curindex = 0;
  var params = [];
  var self = this;

  function level2y (level) { return y0 - level/99 * hsegment; }
  function rate2x  (rate)  { return rate/99 * wsegment; }
  function y2level (y)   { return clamp(y0-y); }
  function x2rate  (x,i) { return clamp((x / wsegment) * 99); }
  function clamp   (x)   { if (x < 0) return 0; if (x > 99) return 99; return x|0; }

  this.startDrag = function (i,pt) {
    curpoint.classList.remove("selected");
    curpoint = points[i].elem.children[0];
    curpoint.classList.add("selected");
    curindex = i;
    if (this.oninput) this.oninput(i, levels[i], rates[i]);
  }
  this.endDrag   = function (i,pt) {}

  this.drag = function (i,pt) {

    // -- level
    let levelChanged = false;
    if (isamp && i == 4) pt.y = y0;
    else {
      let L = y2level(pt.y);
      levelChanged = (L != levels[i]);
      if (levelChanged)
        levels[i] = L;
      pt.y = level2y(L);
    }
    if (i == 3) {
      susline.setAttribute("y1", pt.y);
      susline.setAttribute("y2", pt.y);
    }
    if (i == 0) {
      pt.x = x0;
      if (levelChanged)
        params[0].setValue(levels[i], this);
      //return pt;
    }

    // -- rate
    var r = 0;
    var dsus = (i == 4) ? suslen : 0;
    for (var j=0; j<i; j++) r += rates[j];
    var x = (pt.x - x0 - dsus) - rate2x(r);
    let R = x2rate(x, i);
    let rateChanged = R != rates[i];
    if (rateChanged)
      rates[i] = R;

    pt.x = x0;
    for (var j=0; j<=i; j++)
      pt.x += rate2x(rates[j]);
    var x = pt.x;
    for (var j = i+1; j < 4; j++) {
      x += rate2x(rates[j]);
      points[j].setX(x);
    }

    // -- sustain
    if (i != 4) {
      susline.setAttribute("x1", x);
      susline.setAttribute("x2", x + suslen);
      x += rate2x(rates[4]);
      points[4].setX(x + suslen);
    }

    // -- release
    var p3 = points[3];
    var p4 = points[4];
    var d = "M " + (p3.x + suslen) + " " + p3.y;
    d +=   " Q " + (p3.x + suslen) + " " + p4.y + " " + p4.x + " " + p4.y;
    lines[3].setAttribute("d", d);

    if (rateChanged && i > 0)
      params[i*2-1].setValue(rates[i], this);
    if (levelChanged)
      params[i*2].setValue(levels[i], this);

    if ((levelChanged || rateChanged) && this.oninput)
      this.oninput(i, levels[i], rates[i]);

    pt.x += dsus;
    return pt;
  }

  // -- init
  function init () {

    // -- grid
    var x = x0;
    var w = 4 * wsegment + suslen;
    svg.appendChild( line(x0,y0,x0,y0-hsegment, "gridline") );
    svg.appendChild( line(x0,y0,x0+w,y0, "gridline") );
    svg.appendChild( line(x0,y0-hsegment/2,w,y0-hsegment/2, "gridline") );
    for (var i=1; i<5; i++) {
      x += (i < 4) ? wsegment : suslen;
      svg.appendChild( line(x,y0,x,y0-hsegment, "gridline") );
    }

    x = x0;
    for (var i=0; i<5; i++) {

      // -- point
      x += rate2x(rates[i]);
      var y = level2y(levels[i]);
      var p = new EGPoint(svg, self, i, r, "egpoint");
      if (i == 4) x += suslen;
      p.init(x,y,true);
      points.push(p);

      // -- line
      if (i > 0) {
        var l;
        var q = points[i-1];
        if (i < 4) {
          l = line(q.x, q.y, p.x, p.y, "egline");
          q.L2 = p.L1 = l;
          if (i == 3) {
            susline = line(p.x, p.y, p.x + suslen, p.y, "susline");
            svg.appendChild(susline);
          }
        }
        else {
          var x1 = q.x + suslen;
          l = quadratic(x1, q.y, p.x, p.y, x1, p.y, "egline");
        }
        lines.push(l);
        svg.appendChild(l);
      }
    }
    for (var i=0; i<points.length; i++)
      svg.appendChild(points[i].elem);
    curpoint = points[0].elem.children[0];
    curpoint.classList.add("selected");
  }
  init();

  this.valueChanged = (p) => {
    let n = p.id - (isamp ? 42 : 31);
    let i = (n / 2) | 0;
    if (n % 2 == 0)  levels[i] = p.scaledValue;
    else             rates[i]  = p.scaledValue;
    let v = { level:levels, rate:rates }
    this.value = v;
  }

  this.setValue = (value, israte) => {
    if (israte) {
      if (curindex == 0) return;
      rates[curindex] = value;
    }
    else {
      if (curindex == 4 && isamp) return;
      levels[curindex] = value;
    }

    let v = { level:levels, rate:rates }
    this.value = v;
    if (israte && curindex > 0)
      params[curindex*2 - 1].setValue(rates[curindex], this);
    else
      params[curindex*2].setValue(levels[curindex], this);
  }

  Object.defineProperties(this, {
    value: { set: (v) => {
      for (let i=0; i<5; i++) {
        levels[i] = v.level[i];
        rates[i] = v.rate[i];
        let y = level2y(levels[0]);
        this.drag(0,{x:x0,y:y})
        // return;
      }

      let x = x0;
      let y = 0;
      let z = isamp ? 4 : 5;
      for (let i=0; i<z; i++) {
        x += rate2x(v.rate[i]);
        y = level2y(v.level[i]);
        points[i].setXY(x,y);
        if (i == 3) {
          susline.setAttribute("x1", x);
          susline.setAttribute("x2", x + suslen);
          susline.setAttribute("y1", y);
          susline.setAttribute("y2", y);
          x += suslen;
        }
      }
      // -- release
      var p3 = points[3];
      var p4 = points[4];
      var d = "M " + (p3.x + suslen) + " " + p3.y;
      d +=   " Q " + (p3.x + suslen) + " " + p4.y + " " + p4.x + " " + p4.y;
      lines[3].setAttribute("d", d);
    }},

    param: { set: (v) => {
      params = [];
      for (let i=0; i<v.length; i++) {
        params.push( v[i] );
        v[i].observe(this);
      }
    }}
  });
}
