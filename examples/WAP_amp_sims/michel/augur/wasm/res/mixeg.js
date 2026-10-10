var MixEG = function (svg,p0,r0) {
  var xlevels = [-63,-30,0,30,63];
  var ylevels = [0,0,0,0,0];
  var rates  = [0,50,50,50,50];
  var points = [];
  var lines  = [];
  var joy;
  var r  = 10;
  var r2 = r0 * r0;
  var params = [];
  var self = this;

  function level2r (level) { return p0 + level/63 * r0; }

  // -- init
  function init() {
    // svg = svg.querySelector("#items");

    // -- background
    svg.appendChild( rect(p0-r0,p0-r0,2*r0,2*r0) );
    svg.appendChild( text(p0-r0-27,p0-r0+107, "A", "mixosc") );
    svg.appendChild( text(p0-7,p0-r0-7, "B", "mixosc") );
    svg.appendChild( text(p0+r0+7,p0+r0-92, "C", "mixosc") );
    svg.appendChild( text(p0-7,p0+r0+25, "D", "mixosc") );
    svg.appendChild( circle(p0,p0,r0, "","backcircle") );

    // -- grid
    svg.appendChild( circle(p0,p0,r0/2, "gridcircle") );
    svg.appendChild( circle(p0,p0,r0/2 + r0/4, "gridcircle") );
    svg.appendChild( line(p0,p0-r0,p0,p0+r0, "gridline") );
    svg.appendChild( line(p0-r0,p0,p0+r0,p0, "gridline") );

    for (var i=0; i<5; i++) {
      // -- point
      var p = new EGPoint(svg, self, i, r, "mixpoint");
      var x = level2r(xlevels[i]);
      var y = level2r(ylevels[i]);
      p.init(x,y,true);
      points.push(p);

      // -- line
      if (i > 0) {
        var q = points[i-1];
        var l = line(q.x, q.y, p.x, p.y, "mixline");
        q.L2 = l;
        p.L1 = l;
        lines.push(l);
        svg.appendChild(l);
      }
    }

    // -- append points last so they are on top of z-order
    for (var i=0; i<points.length; i++)
      svg.appendChild(points[i].elem);

    joy = circle(p0,p0,15, "","joy");
    joy.x = joy.y = 0;
    joy.onmousedown = onmouse;
    svg.appendChild(joy);
  }
  init();


  this.valueChanged = (p) => {
    let i = ((p.id - 16) / 2) | 0;
    if (p.id % 2 == 0)  points[i].setX(p0 + p.scaledValue * r0);
    else                points[i].setY(p0 + p.scaledValue * r0);
  }

  Object.defineProperties(this, {
    value: { set: (v) => {
      for (let i=0; i<5; i++)
        points[i].setXY(p0 + v.x[i]/2 * r0, p0 + v.y[i]/2 * r0);
    }},
    param: { set: (v) => {
      params = [];
      for (let i=16; i<26; i++) {
        params.push( v[i] );
        v[i].observe(this);
      }
    }}
  });

  var wasout;
  var anchor = {};
  this.startDrag = function (i,pt) {
    wasout = false;
    anchor.x = pt.x - p0 - points[i].x;
    anchor.y = pt.y - p0 - points[i].y;
  }
  this.endDrag = function (i,pt) {}

  this.drag = function (i,pt) {

    // -- compute new point position
    var mx = pt.x - p0;
    var my = pt.y - p0;
    if ((mx*mx + my*my) <= r2) { // inside drag area
      if (wasout) {
        anchor.x = mx - points[i].x;
        anchor.y = my - points[i].y;
        wasout = false;
      }
      pt.x = mx - anchor.x;
      pt.y = my - anchor.y;
    }
    else {
      wasout = true;
      var angle = Math.atan2(my, mx);
      pt.x = p0 + r0 * Math.cos(angle);
      pt.y = p0 + r0 * Math.sin(angle);
    }

    // -- update levels
    var x = (pt.x - p0) / 100;
    var y = (pt.y - p0) / 100;
    xlevels[i] = (x * 64) | 0;
    ylevels[i] = (y * 64) | 0;
    let id = i*2;
    params[id+0].setValue(xlevels[i], this);
    params[id+1].setValue(ylevels[i], this);

    return pt;
  }

  this.setJoyMode = (active) => {
    points.forEach(p => { p.enable(!active); })
    lines.forEach(l => {
      if (active) l.classList.add("disabled");
      else l.classList.remove("disabled");
    });
    if (active) joy.classList.add("active");
    else joy.classList.remove("active");
  }

  var joyanchor = {};
  var joyout = false;

  function onmouse (e) {
    if (e.type == "mousedown") {
      var pt = dom2svg(svg, e.clientX, e.clientY);
      joyout = false;
      joyanchor.x = pt.x - p0 - joy.x;
      joyanchor.y = pt.y - p0 - joy.y;
      window.addEventListener("mousemove", onmouse, false);
      window.addEventListener("mouseup",   onmouse, false);
    }
    else if (e.type == "mousemove") {
      var pt = dom2svg(svg, e.clientX, e.clientY);
      var mx = pt.x - p0;
      var my = pt.y - p0;
      if ((mx*mx + my*my) <= r2) { // inside drag area
        if (joyout) {
          joyanchor.x = mx - joy.x;
          joyanchor.y = my - joy.y;
          joyout = false;
        }
        pt.x = mx - joyanchor.x;
        pt.y = my - joyanchor.y;
      }
      else {
        joyout = true;
        var angle = Math.atan2(my, mx);
        pt.x = r0 * Math.cos(angle);
        pt.y = r0 * Math.sin(angle);
      }
      joy.x = pt.x;
      joy.y = pt.y;
      var xform = "translate(" + pt.x + " " + pt.y + ")";
      joy.setAttribute("transform", xform);
    }
    else {
      var pt = dom2svg(svg, e.clientX, e.clientY);
      window.removeEventListener("mousemove", onmouse, false);
      window.removeEventListener("mouseup",   onmouse, false);
    }
    e.stopPropagation();
  }

}
