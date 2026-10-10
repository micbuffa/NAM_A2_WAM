var NS = "http://www.w3.org/2000/svg";

function svgGroup (cls) {
  var g = document.createElementNS(NS,"g");
  if (cls) g.setAttribute("class", cls);
  return g;
}

function text (x,y, s, cls) {
  var t = document.createElementNS(NS,"text");
  if (cls) t.setAttribute("class", cls);
  t.setAttribute("x", x);
  t.setAttribute("y", y);
  var content = document.createTextNode(s);
  t.appendChild(content);
  return t;
}

function circle (cx,cy,r, cls,id) {
  var c = document.createElementNS(NS,"circle");
  if (cls) c.setAttribute("class", cls);
  c.setAttribute("cx", cx);
  c.setAttribute("cy", cy);
  if (r) c.setAttribute("r", r);
  if (id) c.setAttribute("id", id);
  return c;
}

function line (x1,y1,x2,y2, cls) {
  var l = document.createElementNS(NS,"line");
  if (cls) l.setAttribute("class", cls);
  l.setAttribute("x1", x1);
  l.setAttribute("x2", x2);
  l.setAttribute("y1", y1);
  l.setAttribute("y2", y2);
  return l;
}

function quadratic (x1,y1,x2,y2, cx,cy, cls) {
  var q = document.createElementNS(NS,"path");
  if (cls) q.setAttribute("class", cls);
  var d = "M" + x1 + " " + y1;
  d += " Q " + cx + " " + cy + " " + x2 + " " + y2;
  q.setAttribute("d", d);
  return q;
}

function rect (x,y,w,h, cls) {
  var r = document.createElementNS(NS,"rect");
  if (cls) r.setAttribute("class", cls);
  r.setAttribute("x", x);
  r.setAttribute("y", y);
  r.setAttribute("width",  w);
  r.setAttribute("height", h);
  return r;
}

function dom2svg (svg,x,y) {
  var pt = svg.createSVGPoint();
  pt.x = x; pt.y = y;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

// from font-awesome
function chevron (type) {
  var svg = document.createElementNS(NS, "svg");
  svg.setAttribute("width", 1792);
  svg.setAttribute("height", 1792);
  svg.setAttribute("viewBox", "0 0 1792 1792");
  // = svg.height = 1792;
  // svg.viewBox = "0 0 1792 1792";
  var d;
  switch (type) {
    case "left":
      d = "M1427 301l-531 531 531 531q19 19 19 45t-19 45l-166 166q-19 19-45 19t-45-19l-742-742q-19-19-19-45t19-45l742-742q19-19 45-19t45 19l166 166q19 19 19 45t-19 45z";
      break;
  }
  var path = document.createElementNS(NS,"path");
  path.setAttribute("d", d);
  path.setAttribute("stroke","black");
  path.setAttribute("fill","black");
  // path.setAttribute("transform","scale(0.2)");
  svg.appendChild(path);
  return svg;
}

function arcpath (cx,cy, r, angle1,angle2) {
  function polar2XY(angle) {
    var rad = (angle-90) * Math.PI / 180.0;
    return {
      x: cx + (r * Math.cos(rad)),
      y: cy + (r * Math.sin(rad))
    };
  }
  var start = polar2XY(angle1);
  var end	  = polar2XY(angle2);
  var bigarc = angle2 - angle1 <= 180 ? 0 : 1;
  return [ "M", start.x, start.y, 
           "A", r, r, 0, bigarc, 1, end.x, end.y
         ].join(" ");
}
