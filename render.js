var boosh = require('boosh');
var dxfparser = require('./dxfstream');
var argv = require('optimist').argv;
var fs = require('fs');
var colors = require('colors');

var window = boosh.createWindow({
  width: 800,
  height: 600
});

window.addEventListener('keydown', function(ev) {
  if (ev.keyCode === 27) {
    window.close();
  }
})


var ctx = window.getContext('2d');

// TODO: implement this in context2d w/ tests
ctx.ellipse = function(x, y, radiusX, radiusY, rotation, startAngle, endAngle, antiClockwise) {
  this.save();
  this.translate(x, y);
  this.scale(radiusX, radiusY);
  this.rotate(rotation);

  this.arc(0, 0, 1, startAngle, endAngle, antiClockwise);
  this.restore();
};


ctx.fillStyle = '#112';
ctx.fillRect(0, 0, window.innerWidth, window.innerHeight);
ctx.translate(window.innerWidth/2-200, window.innerHeight/2-200);
ctx.scale(50, 50)

// ctx.scale(.5, .5)
ctx.lineWidth = .01;
// // ctx.strokeStyle = "red";
// ctx.fillStyle = "red";


var rads = function(degs) {
  var res = degs * (Math.PI/180);

  if (res > Math.PI) {
    res -= Math.PI*2
  }
  return res;
};

var min = Math.min;
var max = Math.max;
var renderers = {
  arc : function(d) {

    var a1 = rads(d.startAngle);
    var a2 = rads(d.endAngle);

    ctx.save();
      ctx.beginPath()
        ctx.translate(d.x, d.y);
        ctx.arc(0, 0, d.radius, a1, a2, false)

        ctx.strokeStyle = "yellow";
        ctx.stroke();
    ctx.restore();
  },
  circle : function(d) {

    ctx.save();
      ctx.beginPath()
        ctx.translate(d.x, d.y);
        ctx.arc(0, 0, d.radius, 0, Math.PI*2, false)

        ctx.strokeStyle = "yellow";
        ctx.stroke();
    ctx.restore();
  },

  dimension : function(d) {


    var dx = d.x5 - d.x4;
    var dy = d.y5 - d.y4;

    ctx.beginPath();
      ctx.moveTo(d.x5, d.y5);
      ctx.lineTo(d.x, d.y)
      // ctx.moveTo(d.x, d.y4+d.y);
      ctx.lineTo(d.x - dx, d.y - dy);
      ctx.lineTo(d.x4, d.y4);
      ctx.strokeStyle = 'red';
      ctx.stroke();
      ctx.font = ".25px san-serif"

      var text = d.actualMeasurement.toFixed(3);
      var size = ctx.measureText(text);

      ctx.fillStyle = "red";

      ctx.fillText(
        text,
        d.textCenterX - size.width / 2,
        d.textCenterY
      );
  },

  ellipse : function(d) {

    var x = d.centerX;
    var y = d.centerY;
    var ex = x + d.majorEndpointX;
    var ey = y + d.majorEndpointY;

    ctx.beginPath();
    ctx.ellipse(
      x,
      y,
      ex,
      ey,
      0,
      d.start,
      d.end,
      false
    );
    ctx.strokeStyle = 'green';

    ctx.stroke();
  },

  line : function(d) {
    ctx.beginPath();
      ctx.moveTo(d.x, d.y);
      ctx.lineTo(d.x2, d.y2);
      ctx.strokeStyle = d.layerName === 'VISIBLE' ? "green" : 'orange'
      ctx.stroke();
  },

  lwpolyline: function(d) {
    ctx.beginPath();
      var verts = d.vertices;
      var l = verts.length;

      ctx.moveTo(verts[0].x, verts[0].y)

      for (var i = 0; i<l; i++) {
        ctx.lineTo(verts[i].x, verts[i].y);
      }

      ctx.strokeStyle = "pink";
    ctx.closePath();
    ctx.stroke();
  },

  spline : function(d) {
    ctx.strokeStyle = '#54FF10';

    var points = d.vertices;
    ctx.beginPath();
      ctx.moveTo(points[0].x, points[0].y);

      for (var i = 1; i < points.length - 2; i ++) {
        var xc = (points[i].x + points[i + 1].x) / 2;
        var yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
      }
      // curve through the last two points
      ctx.quadraticCurveTo(
        points[i].x,
        points[i].y,
        points[i+1].x,
        points[i+1].y
      );

      ctx.strokeStyle = "#F0F";
      ctx.stroke();
  },

  point: function(d) {
    ctx.beginPath();
    ctx.arc(d.x, d.y, 1, 0, Math.PI*2, false);
    ctx.fillStyle = "white";
    ctx.fill();
  },

  polyline: function(d) {
    console.log('polyline', d)
  },

}

fs.createReadStream(argv.file).pipe(dxfparser({ debug : 1 })).on('data', function(data) {
console.log(data);
  if (data.type) {
    var type = data.type.toLowerCase();
    if (renderers[type]) {
      renderers[type](data);
    } else {
      console.error(('missing ' + type + ' renderer').red);
    }
  }
}).on('end', function() {
  window.requestAnimationFrame(function() {}) // render it.
})
