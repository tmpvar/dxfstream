// TODO: turn this into a library

var argv = require('optimist').argv
var fs = require('fs');
var path = require('path');
var split = require('split');
var through = require('through');
var fsm = require('stream-fsm');
var file = argv.file;

var debug = !!argv.debug;

var extend = require('xtend');

var found = [];
var current = [];
var section = null;

var bool = function(val) {
  return !!parseInt(val);
};

var hex = function(val) {
  return parseInt(val, 16);
};

var processors = {};

var pairWise = true, collect = [], header = null, last = null, key = null;
var headerValueMap = {
  '0'  : ['separator', function() {}],
  '1'  : ['text'],
  '2'  : ['name'],
  '3'  : ['value'], // Other text or name values
  '4'  : ['value'], // Other text or name values
  '5'  : ['entityHandle'],
  '6'  : ['lineType'],
  '7'  : ['textStyle'],
  '8'  : ['layerName'],
  '9'  : ['variable', function(line) { key = line; }],
  '10' : ['x', parseFloat],
  '20' : ['y', parseFloat],
  '30' : ['z', parseFloat],

  // Double precision 3D point value

  '11' : ['value', parseFloat],
  '12' : ['value', parseFloat],
  '13' : ['value', parseFloat],
  '14' : ['value', parseFloat],
  '15' : ['value', parseFloat],
  '16' : ['value', parseFloat],
  '17' : ['value', parseFloat],
  '18' : ['value', parseFloat],
  '19' : ['value', parseFloat],
  '21' : ['value', parseFloat],
  '22' : ['value', parseFloat],
  '23' : ['value', parseFloat],
  '24' : ['value', parseFloat],
  '25' : ['value', parseFloat],
  '26' : ['value', parseFloat],
  '27' : ['value', parseFloat],
  '28' : ['value', parseFloat],
  '29' : ['value', parseFloat],
  '30' : ['value', parseFloat],
  '31' : ['value', parseFloat],
  '32' : ['value', parseFloat],
  '33' : ['value', parseFloat],
  '34' : ['value', parseFloat],
  '35' : ['value', parseFloat],
  '36' : ['value', parseFloat],
  '37' : ['value', parseFloat],
  '38' : ['value', parseFloat],
  '39' : ['value', parseFloat],

  // Double-precision floating-point values
  // (text height, scale factors, and so on)
  '40' : ['value', parseFloat],
  '41' : ['value', parseFloat],
  '42' : ['value', parseFloat],
  '43' : ['value', parseFloat],
  '44' : ['value', parseFloat],
  '45' : ['value', parseFloat],
  '46' : ['value', parseFloat],
  '47' : ['value', parseFloat],

  // Angles (output in degrees to DXF files and
  //  radians through AutoLISP and ObjectARX applications)
  '50' : ['value', parseFloat],
  '51' : ['value', parseFloat],
  '52' : ['value', parseFloat],
  '53' : ['value', parseFloat],
  '54' : ['value', parseFloat],
  '55' : ['value', parseFloat],
  '56' : ['value', parseFloat],
  '57' : ['value', parseFloat],
  '58' : ['value', parseFloat],


  // 16-bit integer value
  '60' : ['visibility', parseInt],
  '61' : ['value', parseInt],
  '62' : ['colorNumber', parseInt],
  '63' : ['value', parseInt],
  '64' : ['value', parseInt],
  '65' : ['value', parseInt],
  '66' : ['follow', parseInt],
  '67' : ['space', parseInt],
  '68' : ['viewportStatus', parseInt],
  '69' : ['viewportId', parseInt],

  // Integer values (repeat counts, flag bits, or modes)
  '70' : ['value', parseInt],
  '71' : ['value', parseInt],
  '72' : ['value', parseInt],
  '73' : ['value', parseInt],
  '74' : ['value', parseInt],
  '75' : ['value', parseInt],
  '76' : ['value', parseInt],
  '77' : ['value', parseInt],
  '78' : ['value', parseInt],

  '105' : ['dimvarEntry', parseInt],
  '110' : ['ucsOrigin', parseInt],
  '111' : ['ucsXAxis', parseInt],
  '112' : ['ucsXAxis', parseInt],

  // DXF: Y value of UCS origin, UCS X-axis, and UCS Y-axis
  '120' : ['value', parseInt],
  '121' : ['value', parseInt],
  '122' : ['value', parseInt],

  // Double-precision floating-point values (points, elevation, and DIMSTYLE settings, for example)
  '140' : ['value', parseFloat],
  '141' : ['value', parseFloat],
  '142' : ['value', parseFloat],
  '143' : ['value', parseFloat],
  '144' : ['value', parseFloat],
  '145' : ['value', parseFloat],
  '146' : ['value', parseFloat],
  '147' : ['value', parseFloat],
  '148' : ['value', parseFloat],
  '149' : ['value', parseFloat],

  // 16-bit integer values, such as flag bits representing DIMSTYLE settings
  '170' : ['value', parseInt],
  '171' : ['value', parseInt],
  '172' : ['value', parseInt],
  '173' : ['value', parseInt],
  '174' : ['value', parseInt],
  '175' : ['value', parseInt],
  '176' : ['value', parseInt],
  '177' : ['value', parseInt],
  '178' : ['value', parseInt],
  '179' : ['value', parseInt],

  // Double-precision floating-point value
  '210' : ['value', parseFloat],
  '211' : ['value', parseFloat],
  '212' : ['value', parseFloat],
  '213' : ['value', parseFloat],
  '214' : ['value', parseFloat],
  '215' : ['value', parseFloat],
  '216' : ['value', parseFloat],
  '217' : ['value', parseFloat],
  '218' : ['value', parseFloat],
  '219' : ['value', parseFloat],
  '220' : ['value', parseFloat],
  '221' : ['value', parseFloat],
  '222' : ['value', parseFloat],
  '223' : ['value', parseFloat],
  '224' : ['value', parseFloat],
  '225' : ['value', parseFloat],
  '226' : ['value', parseFloat],
  '227' : ['value', parseFloat],
  '228' : ['value', parseFloat],
  '229' : ['value', parseFloat],
  '230' : ['value', parseFloat],
  '231' : ['value', parseFloat],
  '232' : ['value', parseFloat],
  '233' : ['value', parseFloat],
  '234' : ['value', parseFloat],
  '235' : ['value', parseFloat],
  '236' : ['value', parseFloat],
  '237' : ['value', parseFloat],
  '238' : ['value', parseFloat],
  '239' : ['value', parseFloat],


  // 16-bit integer value
  '270' : ['value', parseInt],
  '271' : ['value', parseInt],
  '272' : ['value', parseInt],
  '273' : ['value', parseInt],
  '274' : ['value', parseInt],
  '275' : ['value', parseInt],
  '276' : ['value', parseInt],
  '277' : ['value', parseInt],
  '278' : ['value', parseInt],
  '279' : ['value', parseInt],
  '280' : ['value', parseInt],
  '281' : ['value', parseInt],
  '282' : ['value', parseInt],
  '283' : ['value', parseInt],
  '284' : ['value', parseInt],
  '285' : ['value', parseInt],
  '286' : ['value', parseInt],
  '287' : ['value', parseInt],
  '288' : ['value', parseInt],
  '289' : ['value', parseInt],

  // Boolean flag value
  '290' : ['value', bool],
  '291' : ['value', bool],
  '292' : ['value', bool],
  '293' : ['value', bool],
  '294' : ['value', bool],
  '295' : ['value', bool],
  '296' : ['value', bool],
  '297' : ['value', bool],
  '298' : ['value', bool],
  '299' : ['value', bool],

  // Hard-pointer handle; arbitrary hard pointers to other objects within same DXF
  // file or drawing. Translated during INSERT and XREF operations
  '340' : ['pointer', hex],
  '341' : ['pointer', hex],
  '342' : ['pointer', hex],
  '343' : ['pointer', hex],
  '344' : ['pointer', hex],
  '345' : ['pointer', hex],
  '346' : ['pointer', hex],
  '347' : ['pointer', hex],
  '348' : ['pointer', hex],
  '349' : ['pointer', hex],

  // Lineweight enum value (AcDb::LineWeight).
  // Stored and moved around as a 16-bit integer.
  // Custom non-entity objects may use the full range,
  // but entity classes only use 371-379 DXF group codes in
  // their representation, because AutoCAD and AutoLISP both
  // always assume a 370 group code is the entity's lineweight.
  // This allows 370 to behave like other “common” entity fields
  '370' : ['value', parseInt],
  '371' : ['value', parseInt],
  '372' : ['value', parseInt],
  '373' : ['value', parseInt],
  '374' : ['value', parseInt],
  '375' : ['value', parseInt],
  '376' : ['value', parseInt],
  '377' : ['value', parseInt],
  '378' : ['value', parseInt],
  '379' : ['value', parseInt],

  // PlotStyleName type enum (AcDb::PlotStyleNameType).
  // Stored and moved around as a 16-bit integer.
  // Custom non-entity objects may use the full range, but entity classes
  // only use 381-389 DXF group codes in their representation, for the
  // same reason as the Lineweight range above
  '380' : ['value', parseInt],
  '381' : ['value', parseInt],
  '382' : ['value', parseInt],
  '383' : ['value', parseInt],
  '384' : ['value', parseInt],
  '385' : ['value', parseInt],
  '386' : ['value', parseInt],
  '387' : ['value', parseInt],
  '388' : ['value', parseInt],
  '389' : ['value', parseInt],

  // 32-bit integer value
  '440' : ['value', parseInt],
  '441' : ['value', parseInt],
  '442' : ['value', parseInt],
  '443' : ['value', parseInt],
  '444' : ['value', parseInt],
  '445' : ['value', parseInt],
  '446' : ['value', parseInt],
  '447' : ['value', parseInt],
  '448' : ['value', parseInt],
  '449' : ['value', parseInt],
}

var count  = 0
var headers = {};
processors.HEADER = function(line) {
  if (pairWise) {
    switch (line) {
      case '9':
        if (header) {
          var keys = Object.keys(header);
          if (keys.length > 1) {
            headers[key] = header;
          } else {
            headers[key] = header[keys[0]];
          }
        }
        header = {};
      break;
    }

    if (headerValueMap[line]) {
      last = headerValueMap[line];
    } else {
      console.log('no value map for', line, last);
    }
  } else {
    if (!last) {
      console.log('miss', line, count);
    } else if (typeof last[1] === 'function') {
      var res = last[1](line);
      if (typeof res !== 'undefined') {
        header[last[0]] = res;
      }
    } else {
      header[last[0]] = line;
    }
  }

  pairWise = !pairWise;
};


var classes = {}, currentClass = null, classKey = null;
var classesValueMap = {
  '0' : [null, function(line) {
    if (currentClass) {
      classes[classKey] = currentClass;
    }
    currentClass = {};
  }],
  '1' : ['name', function(line) {
    classKey = line;
  }],
  '2' : ['className'],
  '3' : ['applicationName'],
  '90' : ['capabilities', parseInt],
  '91' : ['count', parseInt],
  '280' : ['wasProxy', bool],
  '281' : ['isEntity', bool],
}

processors.CLASSES = function(line) {
  if (pairWise) {
    if (classesValueMap[line]) {
      last = classesValueMap[line];
    } else {
      console.log('no value map for', line, last);
    }

  } else {
    if (!last) {
      console.log('miss', line, count);
    } else if (typeof last[1] === 'function') {
      var res = last[1](line);
      if (typeof res !== 'undefined') {
        currentClass[last[0]] = res;
      }
    } else {
      currentClass[last[0]] = line;
    }
  }

  pairWise = !pairWise;
};


var blocks = [], currentBlock = null;
var blockValueMap = extend(headerValueMap, {
  '0' : [null, function(line) {
    if (!line || line === 'ENDBLK' || line === 'BLOCK') {
      if (currentBlock) {
        blocks.push(currentBlock);
      }
      currentBlock = {};
    }
  }],

  '1' : ['xref'],
  '2' : ['name'],
  '3' : ['name'],
  '4' : ['description'],
  '5' : ['handle', hex],

  '8' : ['layerName'],

  '70' : ['type', function(line) {
    return parseInt(line);
  }],

  // I believe this can be ignored as the other group
  // codes will cover the name collection and such
  //
  // There is a potential disparity between the name and the AcDbBlockBegin name
  '100' : ['subclass', function(line) { } ],
  '330' : ['owner', hex],
});


processors.BLOCKS = function(line) {
  if (pairWise) {
    if (blockValueMap[line]) {
      last = blockValueMap[line];
    } else {
      console.log('no value map for', line, last);
      process.exit();
    }

  } else {
    if (!last) {
      console.log('miss', line, count);
    } else if (typeof last[1] === 'function') {
      var res = last[1](line);

      if (typeof res !== 'undefined') {
        currentBlock[last[0]] = res;
      }

    } else {
      currentBlock[last[0]] = line;
    }
  }

  pairWise = !pairWise;
};


var entities = [], currentEntity, currentType;
var noop = function() {};
var commonEntityGroupCodes = extend(headerValueMap, {
  '-1' : ['entityName'],
  '0' : [null, function(line, push) {
    if (currentEntity) {
      push(currentEntity);
      entities.push(currentEntity);
    }

    currentEntity = { type : line };
    currentType = line;
  }],
  '5' : ['handle', hex],
  '6' : ['lineType'], // TODO: not sure what the type is here
  '8' : ['layerName'],

  '39' : ['thickness', parseFloat],

  '330' : ['ownerSoft', hex],
  '360' : ['ownerHard', hex],
  '100' : [null, noop],
  '102' : ['group'],
  '210' : ['extrusionDirectionX', parseFloat],
  '220' : ['extrusionDirectionY', parseFloat],
  '230' : ['extrusionDirectionZ', parseFloat]
});

var entityValueMaps = {};

entityValueMaps.CIRCLE = extend(commonEntityGroupCodes, {
  '40' : ['radius', parseFloat],
});

entityValueMaps.ARC = extend(entityValueMaps.CIRCLE, {
  // TODO: figure out why there is a value: 0 in the result

  '50' : ['startAngle', parseFloat],
  '51' : ['endAngle', parseFloat],
});

entityValueMaps.ELLIPSE = extend(commonEntityGroupCodes, {
  '10' : ['centerX', parseFloat],
  '11' : ['majorEndpointX', parseFloat],
  '20' : ['centerY', parseFloat],
  '21' : ['majorEndpointY', parseFloat],
  '30' : ['centerZ', parseFloat],
  '31' : ['majorEndpointZ', parseFloat],
  '40' : ['majorMinorRatio', parseFloat],
  '41' : ['start', parseFloat], // 0.0 for full ellipse
  '42' : ['end', parseFloat], // 2PI for full ellipse
});

entityValueMaps.LINE = extend(commonEntityGroupCodes, {
  '10' : ['x1', parseFloat],
  '11' : ['x2', parseFloat],
  '20' : ['y1', parseFloat],
  '21' : ['y2', parseFloat],
  '30' : ['z1', parseFloat],
  '31' : ['z2', parseFloat]
});

var currentVertex;
entityValueMaps.LWPOLYLINE = extend(commonEntityGroupCodes, {
  '10' : [null, function(line) {
    if (!currentEntity.vertices) {
      currentEntity.vertices = [];
    }

    currentVertex = { x: parseFloat(line) };
    currentEntity.vertices.push(currentVertex);
  }],
  '20' : [null, function(line) {
    currentVertex.y = parseFloat(line);
  }],
  '38' : ['elevation', parseFloat],
  '40' : ['startingWidth', parseFloat],
  '41' : ['endWidth', parseFloat],
  '42' : ['bulge', parseFloat],
  '42' : ['constantWidth', parseInt],
  '70' : ['polylineFlag', parseInt], // 1 = Closed; 128 = Plinegen
  '90' : ['totalVertices', parseInt],
});

entityValueMaps.MLINE = extend(entityValueMaps.LINE, {
  '2' : ['style'],
  '12' : ['directionVectorX'],
  '22' : ['directionVectorY'],
  '32' : ['directionVectorZ'],

  '13' : ['miterDirectionVectorX'],
  '23' : ['miterDirectionVectorY'],
  '33' : ['miterDirectionVectorZ'],

  '40' : ['scale', parseFloat],

  // TODO: this repeats based on 74
  '41' : ['elementParameters', parseFloat],

  // TODO: this repeats based on 75
  '41' : ['areaFillParameters', parseFloat],

  '70' : ['justification', parseInt], // 0 = Top; 1 = Zero; 2 = Bottom
  '71' : ['flags', parseFloat],
  '72' : ['totalVertices', parseInt],
  '73' : ['totalStyleElements', parseInt], // Number of elements in MLINESTYLE definition
  '73' : ['totalElementParameters', parseInt], // Number of elements in MLINESTYLE definition
  '75' : ['totalAreaFillParameters', parseInt], // Number of elements in MLINESTYLE definition

  '340' : ['styleReference', hex], // Pointer-handle/ID of MLINESTYLE object
});

entityValueMaps.POLYLINE = extend(commonEntityGroupCodes, {
  '66' : [null, noop],
});


// TODO: we may need to change 10, 20, 30 here to include multiple points
entityValueMaps.SPLINE = extend(commonEntityGroupCodes, {
  '11' : ['fitPoints', parseFloat], // TODO: this probably needs to stash into an array
  '12' : ['startTangentX', parseFloat],
  '13' : ['endTangentX', parseFloat],

  '22' : ['startTangentY', parseFloat],
  '23' : ['endTangentY', parseFloat],

  '32' : ['startTangentZ', parseFloat],
  '33' : ['endTangentZ', parseFloat],

  // TODO: populate the knots array
  '40' : ['knots', function() {

  }],

  '42' : ['weight', parseFloat],
  '42' : ['knotTolerance', parseFloat],
  '43' : ['controlPointTolerance', parseFloat],
  '44' : ['fitTolerance', parseFloat],

  '70' : ['flag', parseInt],
  '71' : ['degree', parseFloat],
  '72' : ['totalKnots', parseInt], // TODO: prepare knots array
  '73' : ['totalControlPoints', parseInt], // TODO: prepare controlPoints array
  '74' : ['totalFitPoints', parseInt], // TODO: prepare fit points array
});

entityValueMaps.INSERT = extend(commonEntityGroupCodes, {});

processors.ENTITIES = function(line, push) {
  var source = currentType ?
               entityValueMaps[currentType] :
               commonEntityGroupCodes;

  if (!source) { return; }

  if (pairWise) {
    if (source[line]) {
      last = source[line];
    } else {
      console.error(currentType, 'no value map for', line, last);
      // process.exit();
    }

  } else {
    if (!last) {
      console.log('miss', line, count);
    } else if (typeof last[1] === 'function') {
      var res = last[1](line, push);

      if (typeof res !== 'undefined') {
        currentEntity[last[0]] = res;
      }

    } else {
      currentEntity[last[0]] = line;
    }
  }

  pairWise = !pairWise;
};

// TODO: TABLES
// TODO: OBJECTS
var duplex = require('duplexer');
function createParserStream(options) {
  options = options || {};
  var splitter = split();

  var output = through(function(line) {
    line = line.trim();
    if (line.toLowerCase().indexOf('endsec') < 0) {
      if (current.length > 3) {

        if (processors[current[3]]) {
         processors[current[3]](line, push);
        }
      } else {
        current.push(line);
      }
    } else {
      debug && console.log('drop', current[3]);

      // Ensure we dont acidentally drop the last item found
      processors[current[3]] && processors[current[3]](null, push);

      pairWise = true;
      last = null;
      current = [];
    }
  });

  function push(collected) {
    if (options.json) {
      output.push(JSON.stringify(collected) + '\n');
    } else {
      output.push(collected);
    }
  }

  splitter.pipe(output)

  return duplex(splitter, output);
}


if (require.main === module) {
  fs.createReadStream(file)
    .pipe(createParserStream({ json: true }))
    .on('end', function() {
      if (debug) {
        console.log('ENTITIES', entities);
      }
    })
    .pipe(process.stdout)
;
} else {
  module.exports = createParserStream;
}
