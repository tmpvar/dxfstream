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

var noop = function() {};

var processors = {};

var pairWise = true, collect = [], header = null, last = null, key = null;

var valueMapRange = function(obj, start, end, name, fn, suffixNumber) {
  for (var i = start; i<=end; i++) {
    var key = name;
    if (suffixNumber) {
      if (i>start) {
        key += (i-start) + 1;
      }
    }

    var op = [key];
    if (typeof fn === 'function') {
      op.push(fn);
    }

    obj[i + ''] = op;
  }
};

var headerValueMap = {
  '-5'  : ['reactorChain'],
  '-4'  : ['conditionalOperator'],
  '-3'  : ['extendedData'],
  '-2'  : ['entityNameReference'],
  '-1'  : ['entityName'],

  '0'  : ['separator', noop],
  '1'  : ['text'],
  '2'  : ['name'],
  '3'  : ['value'], // Other text or name values
  '4'  : ['value'], // Other text or name values
  '5'  : ['entityHandle'],
  '6'  : ['lineType'],
  '7'  : ['textStyle'],
  '8'  : ['layerName'],
  '9'  : ['variable', function(line) { key = line; }],

  // 10-18 seen in range below
  // 20-28 seen in range below
  // 30-37 seen in range below

  '38' : ['elevation', parseFloat],
  '39' : ['thickness', parseFloat],

  // 40-47 seen in range below

  '48' : ['lineTypeScale', parseFloat],

  // Repeated double-precision floating-point value. Multiple 49 groups may appear
  // in one entity for variable-length tables (such as the dash lengths in the LTYPE table).
  // A 7x group always appears before the first 49 group to specify the table length
  '49' : ['UNKNOWN-49', function(line) {
    throw new Error('cant handle 49; line: ' + line);
  }],

  // 50-58 seen in range below

  // 16-bit integer value
  '60' : ['visibility', parseInt],
  '61' : ['value', parseInt],
  '62' : ['colorNumber', parseInt],
  '63' : ['value', parseInt],
  '64' : ['value', parseInt],
  '65' : ['value', parseInt],
  '66' : ['entitiesFollow', parseInt],

  // model or paper space
  '67' : ['space', parseInt],

  // identifies whether viewport is on but fully off screen; is not active or is off
  '68' : ['viewportStatus', parseInt],
  '69' : ['viewportId', parseInt],

  // 70-78 seen in range below
  // 80 - 89 undefined
  // 90-99 seen in range below

  '100' : ['subclass'],
  '102' : ['controlString'],
  '105' : ['dimvarEntry', parseInt],

  // Coordinate System (UCS) origin
  // appears this is used with the VIEWPORT Entity
  '110' : ['ucsX', parseInt],
  '111' : ['ucsX', parseInt],
  '112' : ['ucsX', parseInt],
  '120' : ['ucsY', parseFloat],
  '121' : ['ucsY', parseFloat],
  '122' : ['ucsY', parseFloat],
  '130' : ['ucsZ', parseFloat],
  '131' : ['ucsZ', parseFloat],
  '132' : ['ucsZ', parseFloat],

  // 140-149 seen in range below

  '210' : ['extrusionDirectionX', parseFloat],
  '220' : ['extrusionDirectionY', parseFloat],
  '230' : ['extrusionDirectionZ', parseFloat],

  // 270-479 seen in ranges below

  '999' : ['comment'],
  '1000' : ['extendedData'],
  '1001' : ['extendedDataApplicationName'],
  '1002' : ['extendedDataControlString'],
  '1003' : ['extendedDataLayerName'],
  '1004' : ['extendedDataByteChunk'],
  '1005' : ['extendedDataEntityHandle'],

  '1010' : ['pointX', parseFloat],
  '1011' : ['extendWorldPositionX', parseFloat],
  '1012' : ['extendWorldDisplacementX', parseFloat],
  '1013' : ['extendWorldDirectionX', parseFloat],

  '1020' : ['pointY', parseFloat],
  '1021' : ['extendWorldPositionY', parseFloat],
  '1022' : ['extendWorldDisplacementX', parseFloat],
  '1023' : ['extendWorldDirectionX', parseFloat],

  '1030' : ['pointZ', parseFloat],
  '1031' : ['extendWorldPositionZ', parseFloat],
  '1032' : ['extendWorldDisplacementX', parseFloat],
  '1033' : ['extendWorldDirectionX', parseFloat],

  '1040' : ['value', parseFloat],
  '1041' : ['distance', parseFloat],
  '1042' : ['scale', parseFloat],

  '1070' : ['extendedValue', parseInt],
  '1071' : ['extendedValue', parseInt],

};

// Double precision 3D point value
valueMapRange(headerValueMap, 10, 18, 'x', parseFloat, true);
valueMapRange(headerValueMap, 20, 28, 'y', parseFloat, true);
valueMapRange(headerValueMap, 30, 38, 'z', parseFloat, true);

// Double-precision floating-point values
// (text height, scale factors, and so on)
valueMapRange(headerValueMap, 40, 47, 'value', parseFloat);

// Angles (output in degrees to DXF files and
//  radians through AutoLISP and ObjectARX applications)
valueMapRange(headerValueMap, 50, 58, 'value', parseFloat);

// Integer values (repeat counts, flag bits, or modes)
valueMapRange(headerValueMap, 70, 78, 'value', parseInt);

// 32-bit integer values
valueMapRange(headerValueMap, 90, 99, 'value', parseInt);

// Double-precision floating-point values (points, elevation, and DIMSTYLE settings, for example)
valueMapRange(headerValueMap, 140, 149, 'value', parseFloat);

// 16-bit integer values, such as flag bits representing DIMSTYLE settings
valueMapRange(headerValueMap, 170, 179, 'value', parseInt);

// 16-bit integer value
valueMapRange(headerValueMap, 270, 289, 'value', parseInt);

// Boolean flag value
valueMapRange(headerValueMap, 290, 299, 'value', bool);

//Arbitrary text strings
valueMapRange(headerValueMap, 300, 309, 'value', bool);

// Arbitrary binary chunks with same representation and limits as
// 1004 group codes: hexadecimal strings of up to 254 characters represent data chunks of up to 127 bytes
// treat it like a string, if the user wants to decode, it's a new Buffer(..., 'hex') call away
valueMapRange(headerValueMap, 310, 319, 'binary');

// Arbitrary object handles; handle values that are taken “as is”.
// They are not translated during INSERT and XREF operations
valueMapRange(headerValueMap, 310, 319, 'handle');

// Soft-pointer handle; arbitrary soft pointers to other objects within same DXF file or drawing.
// Translated during INSERT and XREF operations
valueMapRange(headerValueMap, 330, 339, 'pointer', hex);

// Hard-pointer handle; arbitrary hard pointers to other objects within same DXF
// file or drawing. Translated during INSERT and XREF operations
valueMapRange(headerValueMap, 340, 349, 'pointer', hex);

// Soft-owner handle; arbitrary soft ownership links to other objects within same DXF
// file or drawing. Translated during INSERT and XREF operations
valueMapRange(headerValueMap, 350, 359, 'pointer', hex);

// Hard-owner handle; arbitrary hard ownership links to other objects within same DXF
// file or drawing. Translated during INSERT and XREF operations
valueMapRange(headerValueMap, 360, 369, 'pointer', hex);

// Lineweight enum value (AcDb::LineWeight).
// Stored and moved around as a 16-bit integer.
// Custom non-entity objects may use the full range,
// but entity classes only use 371-379 DXF group codes in
// their representation, because AutoCAD and AutoLISP both
// always assume a 370 group code is the entity's lineweight.
// This allows 370 to behave like other “common” entity fields
valueMapRange(headerValueMap, 370, 379, 'lineWeight', parseInt);

// PlotStyleName type enum (AcDb::PlotStyleNameType).
// Stored and moved around as a 16-bit integer.
// Custom non-entity objects may use the full range, but entity classes
// only use 381-389 DXF group codes in their representation, for the
// same reason as the Lineweight range above
valueMapRange(headerValueMap, 380, 389, 'plotStyle', parseInt);

// String representing handle value of the PlotStyleName object,
// basically a hard pointer, but has a different range to make backward
// compatibility easier to deal with. Stored and moved around as an object ID
// (a handle in DXF files) and a special type in AutoLISP. Custom non-entity
// objects may use the full range, but entity classes only use 391-399 DXF
// group codes in their represent-ation, for the same reason as the
// lineweight range above
valueMapRange(headerValueMap, 380, 389, 'plotStyleName');

// 16-bit integers
valueMapRange(headerValueMap, 400, 409, 'value', parseInt);

// String
valueMapRange(headerValueMap, 410, 419, 'string');

// 32-bit integer value.
// When used with True Color; a 32-bit integer representing a 24-bit color value.
// The high-order byte (8 bits) is 0, the low-order byte an unsigned char holding the
// Blue value (0-255), then the Green value, and the next-to-high order byte is the Red Value.
// Convering this integer value to hexadecimal yields the following bit mask: 0x00RRGGBB.
// For example, a true color with Red==200, Green==100 and Blue==50 is 0x00C86432, and in DXF,
// in decimal, 13132850
valueMapRange(headerValueMap, 420, 427, 'value', parseInt);

// String; when used for True Color, a string representing the name of the color
valueMapRange(headerValueMap, 430, 437, 'string');

// 32-bit integer value
valueMapRange(headerValueMap, 440, 447, 'value', parseInt);

// Long
valueMapRange(headerValueMap, 450, 459, 'value', parseInt);

// Double-precision floating-point value
valueMapRange(headerValueMap, 460, 469, 'value', parseFloat);

// String
valueMapRange(headerValueMap, 470, 479, 'string');

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
  '40' : ['radius', parseFloat]
});

entityValueMaps.ARC = extend(entityValueMaps.CIRCLE, {
  // TODO: figure out why there is a value: 0 in the result

  '50' : ['startAngle', parseFloat],
  '51' : ['endAngle', parseFloat]
});

entityValueMaps.BODY = extend(commonEntityGroupCodes, {
  '1' : [null, function(line) {
    if (!currentEntity.proprietaryData) {
      currentEntity.proprietaryData = [];
    }
    currentEntity.proprietaryData.push(line);
  }],

  // extra proprietary data (>255 bytes in group 1)
  '3' : [null, function(line) {
    currentEntity.proprietaryData.push(line);
  }],

  '70' : ['version', parseInt]
});

// DIMENSION
entityValueMaps.DIMENSION = extend(commonEntityGroupCodes, {

  // Dimension text explicitly entered by the user. Optional; default is the measurement.
  // If null or “<>”, the dimension measurement is drawn as the text,
  // if ““ (one blank space), the text is suppressed.
  // Anything else is drawn as the text
  '1' : ['text'],

  //  Name of the block that contains the entities that make up the dimension picture
  // TODO: maybe resolve the block and include it?
  '2' : ['blockName'],
  '3' : ['styleName'],

  '11' : ['textCenterX', parseFloat],
  '21' : ['textCenterY', parseFloat],
  '31' : ['textCenterZ', parseFloat],

  //Dimension text-line spacing factor (optional):
  // Percentage of default (3-on-5) line spacing to be applied.
  //Valid values range from 0.25 to 4.00
  '41' : ['lineSpacing', parseFloat],

  '42' : ['actualMeasurement', parseFloat],

  '51' : ['horizontalDirection', parseFloat],
  '53' : ['rotation', parseFloat],

  // Dimension type:
  // Values 0-6 are integer values that represent the dimension type.
  // Values 32, 64, and 128 are bit values, which are added to the integer values
  // (value 32 is always set in R13 and later releases)

  // 0 = Rotated, horizontal, or vertical;
  // 1 = Aligned
  // 2 = Angular
  // 3 = Diameter
  // 4 = Radius
  // 5 = Angular 3 point
  // 6 = Ordinate
  // 32 = Indicates that the block reference (group code 2) is referenced by this dimension only
  // 64 = Ordinate type. This is a bit value (bit 7) used only with integer value 6.
  //      If set, ordinate is X-type; if not set, ordinate is Y-type
  // 128 = This is a bit value (bit 8) added to the other group 70 values if the dimension text
  //       has been positioned at a user-defined location rather than at the default location
  '70' : ['dimensionType', parseInt],

  // Attachment point:
  // 1 = Top left
  // 2 = Top center
  // 3 = Top right
  // 4 = Middle left
  // 5 = Middle center
  // 6 = Middle right
  // 7 = Bottom left
  // 8 = Bottom center
  // 9 = Bottom right
  '71' : ['attachmentPoint', parseInt],

  // 1 = at least (taller characters will override)
  // 2 = exact (taller characters will not override)
  '72' : ['lineSpacing', parseInt],
});

entityValueMaps.ELLIPSE = extend(commonEntityGroupCodes, {
  '10' : ['centerX', parseFloat],
  '11' : ['majorEndpointX', parseFloat],
  '20' : ['centerY', parseFloat],
  '21' : ['majorEndpointY', parseFloat],
  '30' : ['centerZ', parseFloat],
  '31' : ['majorEndpointZ', parseFloat],
  '40' : ['majorMinorRatio', parseFloat], // Ratio of minor axis to major axis
  '41' : ['start', parseFloat],           // 0.0 for full ellipse
  '42' : ['end', parseFloat]             // 2PI for full ellipse
});

entityValueMaps.LIGHT = extend(commonEntityGroupCodes, {

  '11' : ['targetX', parseFloat],
  '21' : ['targetY', parseFloat],
  '31' : ['targetZ', parseFloat],
  '41' : ['attenuationStartLimit', parseFloat],
  '42' : ['attenuationEndLimit', parseFloat],
  '50' : ['hotspotAngle', parseFloat],
  '51' : ['falloffAngle', parseFloat],

  // 1 = distant
  // 2 = point
  // 3 = spot
  '70' : ['type', parseInt],

  // 0 = none
  // 1 = inverse linear
  // 2 = inverse square
  '72' : ['attenuationType', parseInt],

  // 0 = ray traced
  // 1 = shadow maps
  '73' : ['shadowType', parseInt],

  '91' : ['shadowMapSize', parseInt],
  '280' : ['shadowMapSoftness', parseInt],
  '290' : ['status', bool],
  '291' : ['plotGlyph', bool],
  '291' : ['castShadows', bool],
});

entityValueMaps.LINE = extend(commonEntityGroupCodes, {}); // use standard group codes

entityValueMaps.LWPOLYLINE = extend(commonEntityGroupCodes, {
  '10' : [null, function(line) {
    if (!currentEntity.vertices) {
      currentEntity.vertices = [];
    }

    currentVertex = { x: parseFloat(line) };
    currentEntity.vertices.push(currentVertex);
  }],
  '20' : [null, function(line) {
    var verts = currentEntity.vertices;
    verts[verts.length-1].y = parseFloat(line);
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

entityValueMaps.SPLINE = extend(commonEntityGroupCodes, {
  '10' : [null, function(line) {
    if (!currentEntity.vertices) {
      currentEntity.vertices = [];
    }

    currentEntity.vertices.push({
      x : parseFloat(line)
    })
  }],

  '20' : [null, function(line) {
    var verts = currentEntity.vertices;
    verts[verts.length-1].y = parseFloat(line)
  }],


  // TODO: implement me!
  '11' : ['fitPoints', parseFloat],
  '12' : ['startTangentX', parseFloat],
  '13' : ['endTangentX', parseFloat],

  '22' : ['startTangentY', parseFloat],
  '23' : ['endTangentY', parseFloat],

  '32' : ['startTangentZ', parseFloat],
  '33' : ['endTangentZ', parseFloat],

  // TODO: populate the knots array
  '40' : ['knots', function(line) {
    if (!currentEntity.knots) {
      currentEntity.knots = [];
    }

    currentEntity.knots.push(parseFloat(line));
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

entityValueMaps.POINT = extend(commonEntityGroupCodes, {});
entityValueMaps.INSERT = extend(commonEntityGroupCodes, {});


// TODO: implement the remainder
// 3DFACE
// 3DSOLID
// ACAD_PROXY_ENTITY
// ATTDEF
// ATTRIB
// HATCH
// HELIX
// IMAGE
// INSERT
// LEADER
// LIGHT
// MLINE
// MLEADER
// MLEADERSTYLE
// MTEXT
// SOLID
// SURFACE
// TABLE
// TEXT
// VIEWPORT

entityValueMaps.OLEFRAME = extend(commonEntityGroupCodes, {
  '70' : ['version', parseInt],
  '90' : ['length', parseInt]
  // binary data is tracked in common
});

entityValueMaps.OLE2FRAME = extend(entityValueMaps.OLEFRAME, {
  // 1 = link
  // 2 = embedded,
  // 3 = static
  '71' : ['oleType', parseInt],

  // 0 = model space
  // 1 = paper space
  '72' : ['tileMode', parseInt],
});

entityValueMaps.RAY = extend(commonEntityGroupCodes, {
  '11' : ['directionX', parseFloat],
  '21' : ['directionY', parseFloat],
  '31' : ['directionZ', parseFloat]
});

entityValueMaps.REGION = extend(entityValueMaps.BODY, {}); // Extends completely off of BODY

entityValueMaps.SECTION = extend(commonEntityGroupCodes, {
  '1' : ['name', parseInt],

  '10' : ['verticalDirectionX', parseFloat],
  '20' : ['verticalDirectionY', parseFloat],
  '30' : ['verticalDirectionZ', parseFloat],

  // collect vertices
  '11' : [null, function(line) {
    if (!currentEntity.vertices) {
      currentEntity.vertices = [];
    }

    currentEntity.vertices.push({
      x : parseFloat(line)
    });
  }],
  '21' : [null, function(line) {
    currentEntity.vertices[currentEntity.vertices.length-1].y = parseFloat(line);
  }],
  '31' : [null, function(line) {
    currentEntity.vertices[currentEntity.vertices.length-1].z = parseFloat(line);
  }],

  // collect back line vertices
  '12' : [null, function(line) {
    if (!currentEntity.vertices) {
      currentEntity.backVertices = [];
    }

    currentEntity.backVertices.push({
      x : parseFloat(line)
    });
  }],
  '22' : [null, function(line) {
    currentEntity.backVertices[currentEntity.backVertices.length-1].y = parseFloat(line);
  }],
  '32' : [null, function(line) {
    currentEntity.backVertices[currentEntity.backVertices.length-1].z = parseFloat(line);
  }],

  '40' : ['topHeight', parseFloat],
  '41' : ['bottomHeight', parseFloat],
  '63' : ['indicatorColor', parseInt],
  '70' : ['indicatorTransparency', parseInt],
  '90' : ['state', parseInt],
  '91' : ['flags', parseInt],
  '91' : ['totalVertices', parseInt],

  // Hard-pointer ID/handle to geometry settings object
  '360' : ['geometrySettingsHandle', hex],

  // yeah this is a dupe of 63, not sure why
  '411' : ['indicatorColor', parseInt],
});

entityValueMaps.SEQEND = extend(commonEntityGroupCodes, {}); // uses common codes

entityValueMaps.SHAPE = extend(commonEntityGroupCodes, {
  '40' : ['size', parseFloat],
  '41' : ['relativeScaleX', parseFloat], // optional; default = 1
  '50' : ['rotationAngle', parseFloat], // optional; default = 0
  '51' : ['obliqueAngle', parseFloat] // optional; default = 0
});

entityValueMaps.SUN = extend(commonEntityGroupCodes, {
  '40' : ['intensity', parseFloat],

  // 0 = ray traced
  // 1 = shadow maps
  '70' : ['shadowType', parseInt],
  '71' : ['shadowMapSize', parseInt],

  '90' : ['version', parseInt],
  '91' : ['julianDay', parseInt],
  '92' : ['time', parseInt], // in seconds past midnight

  '280' : ['shadowSoftness', parseInt],

  '290' : ['status', bool],
  '291' : ['shadows', bool],
  '292' : ['daylightSavings', bool]
});

entityValueMaps.TOLERANCE = extend(commonEntityGroupCodes, {
  '1' : 'name',
  '3' : ['dimensionStyleName'],
  '11' : ['directionX', parseFloat],
  '21' : ['directionY', parseFloat],
  '31' : ['directionZ', parseFloat]
});

entityValueMaps.TRACE = extend(commonEntityGroupCodes, {}); // uses common codes

entityValueMaps.UNDERLAY = extend(commonEntityGroupCodes, {
  '10' : [null, function(line) {
    if (!currentEntity.points) {
      currentEntity.points = [];
    }
    currentEntity.points.push({ x : parseFloat(line) });
  }],

  '20' : [null, function(line) {
    currentEntity.points[currentEntity.points.length-1].y = parseFloat(line);
  }],

  '30' : [null, function(line) {
    currentEntity.points[currentEntity.points.length-1].z = parseFloat(line);
  }],

  '41' : ['scaleX', parseFloat],
  '42' : ['scaleY', parseFloat],
  '43' : ['scaleZ', parseFloat],
  '50' : ['rotationAngle', parseFloat],

  '210' : ['normalX', parseFloat],
  '220' : ['normalY', parseFloat],
  '230' : ['normalZ', parseFloat],

  //   1 = Clipping is on
  //   2 = Underlay is on
  //   4 = Monochrome
  //   8 = Adjust for background
  '280' : ['flags', parseInt],

  '281' : ['contrast', parseInt], // value between 20 and 100
  '281' : ['fade', parseInt]     // value between 0 and 80
});

entityValueMaps.VERTEX = extend(commonEntityGroupCodes, {
  '40' : ['startingWidth', parseFloat],
  '41' : ['endingWidth', parseFloat],
  '42' : ['bulge', parseFloat],
  '50' : ['tangentDirection', parseFloat],

  // 1 = Extra vertex created by curve-fitting
  // 2 = Curve-fit tangent defined for this vertex.
  //     A curve-fit tangent direction of 0 may be omitted from DXF output
  //     but is significant if this bit is set
  // 4 = Not used
  // 8 = Spline vertex created by spline-fitting
  // 16 = Spline frame control point
  // 32 = 3D polyline vertex
  // 64 = 3D polygon mesh
  // 128 = Polyface mesh vertex
  '70' : ['flags', parseInt],

  // TODO: this may be a bug, but I would need a dxf
  //       that expresses this to fix
  '71' : ['polyfaceMeshVertexIndex', parseInt],
  '72' : ['polyfaceMeshVertexIndex', parseInt],
  '73' : ['polyfaceMeshVertexIndex', parseInt],
  '74' : ['polyfaceMeshVertexIndex', parseInt],

  '100' : ['subclass', function(line) {
    // wait for a line longer than AcDbVertex

    if ('AcDbVertex'.length !== line.length) {
      return line;
    }
  }]
});

entityValueMaps.WIPEOUT = extend(commonEntityGroupCodes, {
  //  U-vector of a single pixel (points along the visual
  //  bottom of the image, starting at the insertion point) (in WCS)
  '11' : ['uVectorX', parseFloat],
  '21' : ['uVectorY', parseFloat],
  '31' : ['uVectorZ', parseFloat],

  //  V-vector of a single pixel
  // (points along the visual left side of the image, starting at
  // the insertion point) (in WCS)
  '12' : ['vVectorX', parseFloat],
  '22' : ['vVectorY', parseFloat],
  '32' : ['vVectorZ', parseFloat],

  '13' : ['imageSizeU', parseFloat],
  '23' : ['imageSizeV', parseFloat],

  // Clip boundary vertex (in OCS)
  //
  // 1) For rectangular clip boundary type, two opposite corners
  //    must be specified. Default is (-0.5,-0.5), (size.x-0.5, size.y-0.5).
  //
  // 2) For polygonal clip boundary type, three or more vertices must be specified.
  //    Polygonal vertices must be listed sequentially
  '14' : [null, function(line) {
    if (!currentEntity.clipBounds) {
      currentEntity.clipBounds = [];
    }

    currentEntity.clipBounds.push({
      x: parseFloat(line)
    });
  }],
  '24' : [null, function(line) {
    var l = currentEntity.clipBounds.length
    currentEntity.clipBounds[l-1].y = parseFloat(line);
  }],
  '34' : [null, function(line) {
    var l = currentEntity.clipBounds.length
    currentEntity.clipBounds[l-1].z = parseFloat(line);
  }],

  // Image display properties:
  // 1 = Show image
  // 2 = Show image when not aligned with screen 4 = Use clipping boundary
  // 8 = Transparency is on
  '70' : ['display', parseInt],
  // Clipping Boundary Type
  // 1 = rectangular
  // 2 = polygonal
  '71' : ['clippingBoundaryType', parseInt],

  '90' : ['classVersion', parseInt],
  '91' : ['totalClipVertices', parseInt],

  // 0 = off
  // 1 = on
  '280' : ['clippingState', parseInt],

  // 0-100 (%)
  '281' : ['brightness', parseInt],
  '282' : ['contrast', parseInt],
  '283' : ['fade', parseInt],

  '340' : ['imagedef', hex],
  '360' : ['imagedefReactor', hex],
});

entityValueMaps.XLINE = extend(commonEntityGroupCodes, {
  '11' : ['directionX', parseFloat],
  '21' : ['directionY', parseFloat],
  '31' : ['directionZ', parseFloat]
});

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
        if (currentEntity[last[0]]) {
          // concatinate strings and such
          currentEntity[last[0]] += res;
        } else {
          currentEntity[last[0]] = res;
        }
      }

    } else {
      currentEntity[last[0]] = line;
    }
  }

  pairWise = !pairWise;
};


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
    .pipe(process.stdout);

} else {
  module.exports = createParserStream;
}
