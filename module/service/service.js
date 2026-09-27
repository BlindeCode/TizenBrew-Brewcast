/******/ (() => { // webpackBootstrap
/******/ 	var __webpack_modules__ = ({

/***/ 26:
/***/ ((module, exports) => {

var __WEBPACK_AMD_DEFINE_ARRAY__, __WEBPACK_AMD_DEFINE_RESULT__;// GENERATED FILE. DO NOT EDIT.
var ipCodec = (function(exports) {
  "use strict";
  
  Object.defineProperty(exports, "__esModule", {
    value: true
  });
  exports.decode = decode;
  exports.encode = encode;
  exports.familyOf = familyOf;
  exports.name = void 0;
  exports.sizeOf = sizeOf;
  exports.v6 = exports.v4 = void 0;
  const v4Regex = /^(\d{1,3}\.){3,3}\d{1,3}$/;
  const v4Size = 4;
  const v6Regex = /^(::)?(((\d{1,3}\.){3}(\d{1,3}){1})?([0-9a-f]){0,4}:{0,2}){1,8}(::)?$/i;
  const v6Size = 16;
  const v4 = {
    name: 'v4',
    size: v4Size,
    isFormat: ip => v4Regex.test(ip),
  
    encode(ip, buff, offset) {
      offset = ~~offset;
      buff = buff || new Uint8Array(offset + v4Size);
      const max = ip.length;
      let n = 0;
  
      for (let i = 0; i < max;) {
        const c = ip.charCodeAt(i++);
  
        if (c === 46) {
          // "."
          buff[offset++] = n;
          n = 0;
        } else {
          n = n * 10 + (c - 48);
        }
      }
  
      buff[offset] = n;
      return buff;
    },
  
    decode(buff, offset) {
      offset = ~~offset;
      return `${buff[offset++]}.${buff[offset++]}.${buff[offset++]}.${buff[offset]}`;
    }
  
  };
  exports.v4 = v4;
  const v6 = {
    name: 'v6',
    size: v6Size,
    isFormat: ip => ip.length > 0 && v6Regex.test(ip),
  
    encode(ip, buff, offset) {
      offset = ~~offset;
      let end = offset + v6Size;
      let fill = -1;
      let hexN = 0;
      let decN = 0;
      let prevColon = true;
      let useDec = false;
      buff = buff || new Uint8Array(offset + v6Size); // Note: This algorithm needs to check if the offset
      // could exceed the buffer boundaries as it supports
      // non-standard compliant encodings that may go beyond
      // the boundary limits. if (offset < end) checks should
      // not be necessary...
  
      for (let i = 0; i < ip.length; i++) {
        let c = ip.charCodeAt(i);
  
        if (c === 58) {
          // :
          if (prevColon) {
            if (fill !== -1) {
              // Not Standard! (standard doesn't allow multiple ::)
              // We need to treat
              if (offset < end) buff[offset] = 0;
              if (offset < end - 1) buff[offset + 1] = 0;
              offset += 2;
            } else if (offset < end) {
              // :: in the middle
              fill = offset;
            }
          } else {
            // : ends the previous number
            if (useDec === true) {
              // Non-standard! (ipv4 should be at end only)
              // A ipv4 address should not be found anywhere else but at
              // the end. This codec also support putting characters
              // after the ipv4 address..
              if (offset < end) buff[offset] = decN;
              offset++;
            } else {
              if (offset < end) buff[offset] = hexN >> 8;
              if (offset < end - 1) buff[offset + 1] = hexN & 0xff;
              offset += 2;
            }
  
            hexN = 0;
            decN = 0;
          }
  
          prevColon = true;
          useDec = false;
        } else if (c === 46) {
          // . indicates IPV4 notation
          if (offset < end) buff[offset] = decN;
          offset++;
          decN = 0;
          hexN = 0;
          prevColon = false;
          useDec = true;
        } else {
          prevColon = false;
  
          if (c >= 97) {
            c -= 87; // a-f ... 97~102 -87 => 10~15
          } else if (c >= 65) {
            c -= 55; // A-F ... 65~70 -55 => 10~15
          } else {
            c -= 48; // 0-9 ... starting from charCode 48
  
            decN = decN * 10 + c;
          } // We don't know yet if its a dec or hex number
  
  
          hexN = (hexN << 4) + c;
        }
      }
  
      if (prevColon === false) {
        // Commiting last number
        if (useDec === true) {
          if (offset < end) buff[offset] = decN;
          offset++;
        } else {
          if (offset < end) buff[offset] = hexN >> 8;
          if (offset < end - 1) buff[offset + 1] = hexN & 0xff;
          offset += 2;
        }
      } else if (fill === 0) {
        // Not Standard! (standard doesn't allow multiple ::)
        // This means that a : was found at the start AND end which means the
        // end needs to be treated as 0 entry...
        if (offset < end) buff[offset] = 0;
        if (offset < end - 1) buff[offset + 1] = 0;
        offset += 2;
      } else if (fill !== -1) {
        // Non-standard! (standard doens't allow multiple ::)
        // Here we find that there has been a :: somewhere in the middle
        // and the end. To treat the end with priority we need to move all
        // written data two bytes to the right.
        offset += 2;
  
        for (let i = Math.min(offset - 1, end - 1); i >= fill + 2; i--) {
          buff[i] = buff[i - 2];
        }
  
        buff[fill] = 0;
        buff[fill + 1] = 0;
        fill = offset;
      }
  
      if (fill !== offset && fill !== -1) {
        // Move the written numbers to the end while filling the everything
        // "fill" to the bytes with zeros.
        if (offset > end - 2) {
          // Non Standard support, when the cursor exceeds bounds.
          offset = end - 2;
        }
  
        while (end > fill) {
          buff[--end] = offset < end && offset > fill ? buff[--offset] : 0;
        }
      } else {
        // Fill the rest with zeros
        while (offset < end) {
          buff[offset++] = 0;
        }
      }
  
      return buff;
    },
  
    decode(buff, offset) {
      offset = ~~offset;
      let result = '';
  
      for (let i = 0; i < v6Size; i += 2) {
        if (i !== 0) {
          result += ':';
        }
  
        result += (buff[offset + i] << 8 | buff[offset + i + 1]).toString(16);
      }
  
      return result.replace(/(^|:)0(:0)*:0(:|$)/, '$1::$3').replace(/:{3,4}/, '::');
    }
  
  };
  exports.v6 = v6;
  const name = 'ip';
  exports.name = name;
  
  function sizeOf(ip) {
    if (v4.isFormat(ip)) return v4.size;
    if (v6.isFormat(ip)) return v6.size;
    throw Error(`Invalid ip address: ${ip}`);
  }
  
  function familyOf(string) {
    return sizeOf(string) === v4.size ? 1 : 2;
  }
  
  function encode(ip, buff, offset) {
    offset = ~~offset;
    const size = sizeOf(ip);
  
    if (typeof buff === 'function') {
      buff = buff(offset + size);
    }
  
    if (size === v4.size) {
      return v4.encode(ip, buff, offset);
    }
  
    return v6.encode(ip, buff, offset);
  }
  
  function decode(buff, offset, length) {
    offset = ~~offset;
    length = length || buff.length - offset;
  
    if (length === v4.size) {
      return v4.decode(buff, offset, length);
    }
  
    if (length === v6.size) {
      return v6.decode(buff, offset, length);
    }
  
    throw Error(`Invalid buffer size needs to be ${v4.size} for v4 or ${v6.size} for v6.`);
  }
  return "default" in exports ? exports.default : exports;
})({});
if (true) !(__WEBPACK_AMD_DEFINE_ARRAY__ = [], __WEBPACK_AMD_DEFINE_RESULT__ = (function() { return ipCodec; }).apply(exports, __WEBPACK_AMD_DEFINE_ARRAY__),
		__WEBPACK_AMD_DEFINE_RESULT__ !== undefined && (module.exports = __WEBPACK_AMD_DEFINE_RESULT__));
else {}


/***/ }),

/***/ 74:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Queue = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const queue_item_1 = __webpack_require__(1800);
class Queue {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsQueue(bb, obj) {
        return (obj || new Queue()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsQueue(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new Queue()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    items(index, obj) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? (obj || new queue_item_1.QueueItem()).__init(this.bb.__indirect(this.bb.__vector(this.bb_pos + offset) + index * 4), this.bb) : null;
    }
    itemsLength() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
    }
    startIndex() {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.readUint8(this.bb_pos + offset) : null;
    }
    autoplay() {
        const offset = this.bb.__offset(this.bb_pos, 8);
        return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false;
    }
    static startQueue(builder) {
        builder.startObject(3);
    }
    static addItems(builder, itemsOffset) {
        builder.addFieldOffset(0, itemsOffset, 0);
    }
    static createItemsVector(builder, data) {
        builder.startVector(4, data.length, 4);
        for (let i = data.length - 1; i >= 0; i--) {
            builder.addOffset(data[i]);
        }
        return builder.endVector();
    }
    static startItemsVector(builder, numElems) {
        builder.startVector(4, numElems, 4);
    }
    static addStartIndex(builder, startIndex) {
        builder.addFieldInt8(1, startIndex, null);
    }
    static addAutoplay(builder, autoplay) {
        builder.addFieldInt8(2, +autoplay, +false);
    }
    static endQueue(builder) {
        const offset = builder.endObject();
        builder.requiredField(offset, 4); // items
        return offset;
    }
    static createQueue(builder, itemsOffset, startIndex, autoplay) {
        Queue.startQueue(builder);
        Queue.addItems(builder, itemsOffset);
        if (startIndex !== null)
            Queue.addStartIndex(builder, startIndex);
        Queue.addAutoplay(builder, autoplay);
        return Queue.endQueue(builder);
    }
}
exports.Queue = Queue;


/***/ }),

/***/ 82:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ResourceReadHead = exports.RequestHeader = exports.ReceiverIntroduction = exports.ReceiverCapabilities = exports.QueueRemove = exports.QueuePosition = exports.QueueMarkerFront = exports.QueueMarkerBack = exports.QueueItemSelected = exports.QueueItem = exports.QueueInsert = exports.QueueIndex = exports.Queue = exports.ProgressChanged = exports.PlaybackStateChanged = exports.PlaybackState = exports.Packet = exports.MirroringSessionDescription = exports.MetadataKV = exports.Metadata = exports.Message = exports.MediaTrackType = exports.MediaTrackMetadata = exports.MediaTrack = exports.MediaSource = exports.MediaItem = exports.MediaCapabilities = exports.Load = exports.KnownResourceSize = exports.GenericMetaValue = exports.GenericMetaString = exports.GenericMetaList = exports.GenericMetaInt = exports.GenericMetaFloat = exports.ErrorKind = exports.Error = exports.DisplayCapabilities = exports.DeviceInfo = exports.CompanionResourceSize = exports.CompanionResourceRequest = exports.CompanionResourceInfoResponse = exports.CompanionResourceInfoRequest = exports.CompanionHelloResponse = exports.CompanionHelloRequest = exports.Chapter = exports.ChangeTrack = exports.AudioTrackMeta = exports.AudioMetadata = exports.AudioCapabilities = exports.AddSubtitleSource = void 0;
exports.WrappedGenericMetaValue = exports.VolumeChanged = exports.VideoTrackMeta = exports.VideoResolution = exports.VideoMetadata = exports.UnknownResourceSize = exports.TracksAvailable = exports.Time = exports.SubtitleTrackMeta = exports.StopPlayback = exports.StartMirroringSession = exports.SpeedChanged = exports.SetProgressUpdateInterval = exports.SenderIntroduction = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
var add_subtitle_source_1 = __webpack_require__(281);
Object.defineProperty(exports, "AddSubtitleSource", ({ enumerable: true, get: function () { return add_subtitle_source_1.AddSubtitleSource; } }));
var audio_capabilities_1 = __webpack_require__(1162);
Object.defineProperty(exports, "AudioCapabilities", ({ enumerable: true, get: function () { return audio_capabilities_1.AudioCapabilities; } }));
var audio_metadata_1 = __webpack_require__(1717);
Object.defineProperty(exports, "AudioMetadata", ({ enumerable: true, get: function () { return audio_metadata_1.AudioMetadata; } }));
var audio_track_meta_1 = __webpack_require__(1179);
Object.defineProperty(exports, "AudioTrackMeta", ({ enumerable: true, get: function () { return audio_track_meta_1.AudioTrackMeta; } }));
var change_track_1 = __webpack_require__(6459);
Object.defineProperty(exports, "ChangeTrack", ({ enumerable: true, get: function () { return change_track_1.ChangeTrack; } }));
var chapter_1 = __webpack_require__(528);
Object.defineProperty(exports, "Chapter", ({ enumerable: true, get: function () { return chapter_1.Chapter; } }));
var companion_hello_request_1 = __webpack_require__(5018);
Object.defineProperty(exports, "CompanionHelloRequest", ({ enumerable: true, get: function () { return companion_hello_request_1.CompanionHelloRequest; } }));
var companion_hello_response_1 = __webpack_require__(8168);
Object.defineProperty(exports, "CompanionHelloResponse", ({ enumerable: true, get: function () { return companion_hello_response_1.CompanionHelloResponse; } }));
var companion_resource_info_request_1 = __webpack_require__(4777);
Object.defineProperty(exports, "CompanionResourceInfoRequest", ({ enumerable: true, get: function () { return companion_resource_info_request_1.CompanionResourceInfoRequest; } }));
var companion_resource_info_response_1 = __webpack_require__(7189);
Object.defineProperty(exports, "CompanionResourceInfoResponse", ({ enumerable: true, get: function () { return companion_resource_info_response_1.CompanionResourceInfoResponse; } }));
var companion_resource_request_1 = __webpack_require__(2268);
Object.defineProperty(exports, "CompanionResourceRequest", ({ enumerable: true, get: function () { return companion_resource_request_1.CompanionResourceRequest; } }));
var companion_resource_size_1 = __webpack_require__(1564);
Object.defineProperty(exports, "CompanionResourceSize", ({ enumerable: true, get: function () { return companion_resource_size_1.CompanionResourceSize; } }));
var device_info_1 = __webpack_require__(5312);
Object.defineProperty(exports, "DeviceInfo", ({ enumerable: true, get: function () { return device_info_1.DeviceInfo; } }));
var display_capabilities_1 = __webpack_require__(2126);
Object.defineProperty(exports, "DisplayCapabilities", ({ enumerable: true, get: function () { return display_capabilities_1.DisplayCapabilities; } }));
var error_1 = __webpack_require__(1907);
Object.defineProperty(exports, "Error", ({ enumerable: true, get: function () { return error_1.Error; } }));
var error_kind_1 = __webpack_require__(5402);
Object.defineProperty(exports, "ErrorKind", ({ enumerable: true, get: function () { return error_kind_1.ErrorKind; } }));
var generic_meta_float_1 = __webpack_require__(8831);
Object.defineProperty(exports, "GenericMetaFloat", ({ enumerable: true, get: function () { return generic_meta_float_1.GenericMetaFloat; } }));
var generic_meta_int_1 = __webpack_require__(9300);
Object.defineProperty(exports, "GenericMetaInt", ({ enumerable: true, get: function () { return generic_meta_int_1.GenericMetaInt; } }));
var generic_meta_list_1 = __webpack_require__(8317);
Object.defineProperty(exports, "GenericMetaList", ({ enumerable: true, get: function () { return generic_meta_list_1.GenericMetaList; } }));
var generic_meta_string_1 = __webpack_require__(1356);
Object.defineProperty(exports, "GenericMetaString", ({ enumerable: true, get: function () { return generic_meta_string_1.GenericMetaString; } }));
var generic_meta_value_1 = __webpack_require__(1620);
Object.defineProperty(exports, "GenericMetaValue", ({ enumerable: true, get: function () { return generic_meta_value_1.GenericMetaValue; } }));
var known_resource_size_1 = __webpack_require__(8733);
Object.defineProperty(exports, "KnownResourceSize", ({ enumerable: true, get: function () { return known_resource_size_1.KnownResourceSize; } }));
var load_1 = __webpack_require__(4097);
Object.defineProperty(exports, "Load", ({ enumerable: true, get: function () { return load_1.Load; } }));
var media_capabilities_1 = __webpack_require__(2292);
Object.defineProperty(exports, "MediaCapabilities", ({ enumerable: true, get: function () { return media_capabilities_1.MediaCapabilities; } }));
var media_item_1 = __webpack_require__(2561);
Object.defineProperty(exports, "MediaItem", ({ enumerable: true, get: function () { return media_item_1.MediaItem; } }));
var media_source_1 = __webpack_require__(9659);
Object.defineProperty(exports, "MediaSource", ({ enumerable: true, get: function () { return media_source_1.MediaSource; } }));
var media_track_1 = __webpack_require__(8335);
Object.defineProperty(exports, "MediaTrack", ({ enumerable: true, get: function () { return media_track_1.MediaTrack; } }));
var media_track_metadata_1 = __webpack_require__(1973);
Object.defineProperty(exports, "MediaTrackMetadata", ({ enumerable: true, get: function () { return media_track_metadata_1.MediaTrackMetadata; } }));
var media_track_type_1 = __webpack_require__(1392);
Object.defineProperty(exports, "MediaTrackType", ({ enumerable: true, get: function () { return media_track_type_1.MediaTrackType; } }));
var message_1 = __webpack_require__(2053);
Object.defineProperty(exports, "Message", ({ enumerable: true, get: function () { return message_1.Message; } }));
var metadata_1 = __webpack_require__(6496);
Object.defineProperty(exports, "Metadata", ({ enumerable: true, get: function () { return metadata_1.Metadata; } }));
var metadata_kv_1 = __webpack_require__(4560);
Object.defineProperty(exports, "MetadataKV", ({ enumerable: true, get: function () { return metadata_kv_1.MetadataKV; } }));
var mirroring_session_description_1 = __webpack_require__(7466);
Object.defineProperty(exports, "MirroringSessionDescription", ({ enumerable: true, get: function () { return mirroring_session_description_1.MirroringSessionDescription; } }));
var packet_1 = __webpack_require__(7829);
Object.defineProperty(exports, "Packet", ({ enumerable: true, get: function () { return packet_1.Packet; } }));
var playback_state_1 = __webpack_require__(324);
Object.defineProperty(exports, "PlaybackState", ({ enumerable: true, get: function () { return playback_state_1.PlaybackState; } }));
var playback_state_changed_1 = __webpack_require__(2757);
Object.defineProperty(exports, "PlaybackStateChanged", ({ enumerable: true, get: function () { return playback_state_changed_1.PlaybackStateChanged; } }));
var progress_changed_1 = __webpack_require__(3091);
Object.defineProperty(exports, "ProgressChanged", ({ enumerable: true, get: function () { return progress_changed_1.ProgressChanged; } }));
var queue_1 = __webpack_require__(74);
Object.defineProperty(exports, "Queue", ({ enumerable: true, get: function () { return queue_1.Queue; } }));
var queue_index_1 = __webpack_require__(8535);
Object.defineProperty(exports, "QueueIndex", ({ enumerable: true, get: function () { return queue_index_1.QueueIndex; } }));
var queue_insert_1 = __webpack_require__(6762);
Object.defineProperty(exports, "QueueInsert", ({ enumerable: true, get: function () { return queue_insert_1.QueueInsert; } }));
var queue_item_1 = __webpack_require__(1800);
Object.defineProperty(exports, "QueueItem", ({ enumerable: true, get: function () { return queue_item_1.QueueItem; } }));
var queue_item_selected_1 = __webpack_require__(4340);
Object.defineProperty(exports, "QueueItemSelected", ({ enumerable: true, get: function () { return queue_item_selected_1.QueueItemSelected; } }));
var queue_marker_back_1 = __webpack_require__(7825);
Object.defineProperty(exports, "QueueMarkerBack", ({ enumerable: true, get: function () { return queue_marker_back_1.QueueMarkerBack; } }));
var queue_marker_front_1 = __webpack_require__(2119);
Object.defineProperty(exports, "QueueMarkerFront", ({ enumerable: true, get: function () { return queue_marker_front_1.QueueMarkerFront; } }));
var queue_position_1 = __webpack_require__(7548);
Object.defineProperty(exports, "QueuePosition", ({ enumerable: true, get: function () { return queue_position_1.QueuePosition; } }));
var queue_remove_1 = __webpack_require__(3463);
Object.defineProperty(exports, "QueueRemove", ({ enumerable: true, get: function () { return queue_remove_1.QueueRemove; } }));
var receiver_capabilities_1 = __webpack_require__(4947);
Object.defineProperty(exports, "ReceiverCapabilities", ({ enumerable: true, get: function () { return receiver_capabilities_1.ReceiverCapabilities; } }));
var receiver_introduction_1 = __webpack_require__(937);
Object.defineProperty(exports, "ReceiverIntroduction", ({ enumerable: true, get: function () { return receiver_introduction_1.ReceiverIntroduction; } }));
var request_header_1 = __webpack_require__(756);
Object.defineProperty(exports, "RequestHeader", ({ enumerable: true, get: function () { return request_header_1.RequestHeader; } }));
var resource_read_head_1 = __webpack_require__(1085);
Object.defineProperty(exports, "ResourceReadHead", ({ enumerable: true, get: function () { return resource_read_head_1.ResourceReadHead; } }));
var sender_introduction_1 = __webpack_require__(5765);
Object.defineProperty(exports, "SenderIntroduction", ({ enumerable: true, get: function () { return sender_introduction_1.SenderIntroduction; } }));
var set_progress_update_interval_1 = __webpack_require__(4281);
Object.defineProperty(exports, "SetProgressUpdateInterval", ({ enumerable: true, get: function () { return set_progress_update_interval_1.SetProgressUpdateInterval; } }));
var speed_changed_1 = __webpack_require__(7699);
Object.defineProperty(exports, "SpeedChanged", ({ enumerable: true, get: function () { return speed_changed_1.SpeedChanged; } }));
var start_mirroring_session_1 = __webpack_require__(6620);
Object.defineProperty(exports, "StartMirroringSession", ({ enumerable: true, get: function () { return start_mirroring_session_1.StartMirroringSession; } }));
var stop_playback_1 = __webpack_require__(6311);
Object.defineProperty(exports, "StopPlayback", ({ enumerable: true, get: function () { return stop_playback_1.StopPlayback; } }));
var subtitle_track_meta_1 = __webpack_require__(6469);
Object.defineProperty(exports, "SubtitleTrackMeta", ({ enumerable: true, get: function () { return subtitle_track_meta_1.SubtitleTrackMeta; } }));
var time_1 = __webpack_require__(6004);
Object.defineProperty(exports, "Time", ({ enumerable: true, get: function () { return time_1.Time; } }));
var tracks_available_1 = __webpack_require__(4863);
Object.defineProperty(exports, "TracksAvailable", ({ enumerable: true, get: function () { return tracks_available_1.TracksAvailable; } }));
var unknown_resource_size_1 = __webpack_require__(3772);
Object.defineProperty(exports, "UnknownResourceSize", ({ enumerable: true, get: function () { return unknown_resource_size_1.UnknownResourceSize; } }));
var video_metadata_1 = __webpack_require__(178);
Object.defineProperty(exports, "VideoMetadata", ({ enumerable: true, get: function () { return video_metadata_1.VideoMetadata; } }));
var video_resolution_1 = __webpack_require__(813);
Object.defineProperty(exports, "VideoResolution", ({ enumerable: true, get: function () { return video_resolution_1.VideoResolution; } }));
var video_track_meta_1 = __webpack_require__(9084);
Object.defineProperty(exports, "VideoTrackMeta", ({ enumerable: true, get: function () { return video_track_meta_1.VideoTrackMeta; } }));
var volume_changed_1 = __webpack_require__(1694);
Object.defineProperty(exports, "VolumeChanged", ({ enumerable: true, get: function () { return volume_changed_1.VolumeChanged; } }));
var wrapped_generic_meta_value_1 = __webpack_require__(9028);
Object.defineProperty(exports, "WrappedGenericMetaValue", ({ enumerable: true, get: function () { return wrapped_generic_meta_value_1.WrappedGenericMetaValue; } }));


/***/ }),

/***/ 147:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

/*
 * Traditional DNS header RCODEs (4-bits) defined by IANA in
 * https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml
 */
exports.toString = function (rcode) {
    switch (rcode) {
        case 0: return 'NOERROR';
        case 1: return 'FORMERR';
        case 2: return 'SERVFAIL';
        case 3: return 'NXDOMAIN';
        case 4: return 'NOTIMP';
        case 5: return 'REFUSED';
        case 6: return 'YXDOMAIN';
        case 7: return 'YXRRSET';
        case 8: return 'NXRRSET';
        case 9: return 'NOTAUTH';
        case 10: return 'NOTZONE';
        case 11: return 'RCODE_11';
        case 12: return 'RCODE_12';
        case 13: return 'RCODE_13';
        case 14: return 'RCODE_14';
        case 15: return 'RCODE_15';
    }
    return 'RCODE_' + rcode;
};
exports.toRcode = function (code) {
    switch (code.toUpperCase()) {
        case 'NOERROR': return 0;
        case 'FORMERR': return 1;
        case 'SERVFAIL': return 2;
        case 'NXDOMAIN': return 3;
        case 'NOTIMP': return 4;
        case 'REFUSED': return 5;
        case 'YXDOMAIN': return 6;
        case 'YXRRSET': return 7;
        case 'NXRRSET': return 8;
        case 'NOTAUTH': return 9;
        case 'NOTZONE': return 10;
        case 'RCODE_11': return 11;
        case 'RCODE_12': return 12;
        case 'RCODE_13': return 13;
        case 'RCODE_14': return 14;
        case 'RCODE_15': return 15;
    }
    return 0;
};


/***/ }),

/***/ 178:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VideoMetadata = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const chapter_1 = __webpack_require__(528);
class VideoMetadata {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsVideoMetadata(bb, obj) {
        return (obj || new VideoMetadata()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsVideoMetadata(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new VideoMetadata()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    chapters(index, obj) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? (obj || new chapter_1.Chapter()).__init(this.bb.__indirect(this.bb.__vector(this.bb_pos + offset) + index * 4), this.bb) : null;
    }
    chaptersLength() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
    }
    static startVideoMetadata(builder) {
        builder.startObject(1);
    }
    static addChapters(builder, chaptersOffset) {
        builder.addFieldOffset(0, chaptersOffset, 0);
    }
    static createChaptersVector(builder, data) {
        builder.startVector(4, data.length, 4);
        for (let i = data.length - 1; i >= 0; i--) {
            builder.addOffset(data[i]);
        }
        return builder.endVector();
    }
    static startChaptersVector(builder, numElems) {
        builder.startVector(4, numElems, 4);
    }
    static endVideoMetadata(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createVideoMetadata(builder, chaptersOffset) {
        VideoMetadata.startVideoMetadata(builder);
        VideoMetadata.addChapters(builder, chaptersOffset);
        return VideoMetadata.endVideoMetadata(builder);
    }
}
exports.VideoMetadata = VideoMetadata;


/***/ }),

/***/ 181:
/***/ ((module) => {

"use strict";
module.exports = require("buffer");

/***/ }),

/***/ 206:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  NIL: () => (/* reexport */ nil),
  parse: () => (/* reexport */ esm_node_parse),
  stringify: () => (/* reexport */ esm_node_stringify),
  v1: () => (/* reexport */ esm_node_v1),
  v3: () => (/* reexport */ esm_node_v3),
  v4: () => (/* reexport */ esm_node_v4),
  v5: () => (/* reexport */ esm_node_v5),
  validate: () => (/* reexport */ esm_node_validate),
  version: () => (/* reexport */ esm_node_version)
});

// EXTERNAL MODULE: external "crypto"
var external_crypto_ = __webpack_require__(6982);
var external_crypto_default = /*#__PURE__*/__webpack_require__.n(external_crypto_);
;// ./node_modules/uuid/dist/esm-node/rng.js

const rnds8Pool = new Uint8Array(256); // # of random values to pre-allocate
let poolPtr = rnds8Pool.length;
function rng() {
    if (poolPtr > rnds8Pool.length - 16) {
        external_crypto_default().randomFillSync(rnds8Pool);
        poolPtr = 0;
    }
    return rnds8Pool.slice(poolPtr, poolPtr += 16);
}

;// ./node_modules/uuid/dist/esm-node/regex.js
/* harmony default export */ const regex = (/^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|00000000-0000-0000-0000-000000000000)$/i);

;// ./node_modules/uuid/dist/esm-node/validate.js

function validate(uuid) {
    return typeof uuid === 'string' && regex.test(uuid);
}
/* harmony default export */ const esm_node_validate = (validate);

;// ./node_modules/uuid/dist/esm-node/stringify.js

/**
 * Convert array of 16 byte values to UUID string format of the form:
 * XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX
 */
const byteToHex = [];
for (let i = 0; i < 256; ++i) {
    byteToHex.push((i + 0x100).toString(16).slice(1));
}
function unsafeStringify(arr, offset = 0) {
    // Note: Be careful editing this code!  It's been tuned for performance
    // and works in ways you may not expect. See https://github.com/uuidjs/uuid/pull/434
    return byteToHex[arr[offset + 0]] + byteToHex[arr[offset + 1]] + byteToHex[arr[offset + 2]] + byteToHex[arr[offset + 3]] + '-' + byteToHex[arr[offset + 4]] + byteToHex[arr[offset + 5]] + '-' + byteToHex[arr[offset + 6]] + byteToHex[arr[offset + 7]] + '-' + byteToHex[arr[offset + 8]] + byteToHex[arr[offset + 9]] + '-' + byteToHex[arr[offset + 10]] + byteToHex[arr[offset + 11]] + byteToHex[arr[offset + 12]] + byteToHex[arr[offset + 13]] + byteToHex[arr[offset + 14]] + byteToHex[arr[offset + 15]];
}
function stringify(arr, offset = 0) {
    const uuid = unsafeStringify(arr, offset); // Consistency check for valid UUID.  If this throws, it's likely due to one
    // of the following:
    // - One or more input array values don't map to a hex octet (leading to
    // "undefined" in the uuid)
    // - Invalid input values for the RFC `version` or `variant` fields
    if (!esm_node_validate(uuid)) {
        throw TypeError('Stringified UUID is invalid');
    }
    return uuid;
}
/* harmony default export */ const esm_node_stringify = (stringify);

;// ./node_modules/uuid/dist/esm-node/v1.js

 // **`v1()` - Generate time-based UUID**
//
// Inspired by https://github.com/LiosK/UUID.js
// and http://docs.python.org/library/uuid.html
let _nodeId;
let _clockseq; // Previous uuid creation time
let _lastMSecs = 0;
let _lastNSecs = 0; // See https://github.com/uuidjs/uuid for API details
function v1(options, buf, offset) {
    let i = buf && offset || 0;
    const b = buf || new Array(16);
    options = options || {};
    let node = options.node || _nodeId;
    let clockseq = options.clockseq !== undefined ? options.clockseq : _clockseq; // node and clockseq need to be initialized to random values if they're not
    // specified.  We do this lazily to minimize issues related to insufficient
    // system entropy.  See #189
    if (node == null || clockseq == null) {
        const seedBytes = options.random || (options.rng || rng)();
        if (node == null) {
            // Per 4.5, create and 48-bit node id, (47 random bits + multicast bit = 1)
            node = _nodeId = [seedBytes[0] | 0x01, seedBytes[1], seedBytes[2], seedBytes[3], seedBytes[4], seedBytes[5]];
        }
        if (clockseq == null) {
            // Per 4.2.2, randomize (14 bit) clockseq
            clockseq = _clockseq = (seedBytes[6] << 8 | seedBytes[7]) & 0x3fff;
        }
    } // UUID timestamps are 100 nano-second units since the Gregorian epoch,
    // (1582-10-15 00:00).  JSNumbers aren't precise enough for this, so
    // time is handled internally as 'msecs' (integer milliseconds) and 'nsecs'
    // (100-nanoseconds offset from msecs) since unix epoch, 1970-01-01 00:00.
    let msecs = options.msecs !== undefined ? options.msecs : Date.now(); // Per 4.2.1.2, use count of uuid's generated during the current clock
    // cycle to simulate higher resolution clock
    let nsecs = options.nsecs !== undefined ? options.nsecs : _lastNSecs + 1; // Time since last uuid creation (in msecs)
    const dt = msecs - _lastMSecs + (nsecs - _lastNSecs) / 10000; // Per 4.2.1.2, Bump clockseq on clock regression
    if (dt < 0 && options.clockseq === undefined) {
        clockseq = clockseq + 1 & 0x3fff;
    } // Reset nsecs if clock regresses (new clockseq) or we've moved onto a new
    // time interval
    if ((dt < 0 || msecs > _lastMSecs) && options.nsecs === undefined) {
        nsecs = 0;
    } // Per 4.2.1.2 Throw error if too many uuids are requested
    if (nsecs >= 10000) {
        throw new Error("uuid.v1(): Can't create more than 10M uuids/sec");
    }
    _lastMSecs = msecs;
    _lastNSecs = nsecs;
    _clockseq = clockseq; // Per 4.1.4 - Convert from unix epoch to Gregorian epoch
    msecs += 12219292800000; // `time_low`
    const tl = ((msecs & 0xfffffff) * 10000 + nsecs) % 0x100000000;
    b[i++] = tl >>> 24 & 0xff;
    b[i++] = tl >>> 16 & 0xff;
    b[i++] = tl >>> 8 & 0xff;
    b[i++] = tl & 0xff; // `time_mid`
    const tmh = msecs / 0x100000000 * 10000 & 0xfffffff;
    b[i++] = tmh >>> 8 & 0xff;
    b[i++] = tmh & 0xff; // `time_high_and_version`
    b[i++] = tmh >>> 24 & 0xf | 0x10; // include version
    b[i++] = tmh >>> 16 & 0xff; // `clock_seq_hi_and_reserved` (Per 4.2.2 - include variant)
    b[i++] = clockseq >>> 8 | 0x80; // `clock_seq_low`
    b[i++] = clockseq & 0xff; // `node`
    for (let n = 0; n < 6; ++n) {
        b[i + n] = node[n];
    }
    return buf || unsafeStringify(b);
}
/* harmony default export */ const esm_node_v1 = (v1);

;// ./node_modules/uuid/dist/esm-node/parse.js

function parse(uuid) {
    if (!esm_node_validate(uuid)) {
        throw TypeError('Invalid UUID');
    }
    let v;
    const arr = new Uint8Array(16); // Parse ########-....-....-....-............
    arr[0] = (v = parseInt(uuid.slice(0, 8), 16)) >>> 24;
    arr[1] = v >>> 16 & 0xff;
    arr[2] = v >>> 8 & 0xff;
    arr[3] = v & 0xff; // Parse ........-####-....-....-............
    arr[4] = (v = parseInt(uuid.slice(9, 13), 16)) >>> 8;
    arr[5] = v & 0xff; // Parse ........-....-####-....-............
    arr[6] = (v = parseInt(uuid.slice(14, 18), 16)) >>> 8;
    arr[7] = v & 0xff; // Parse ........-....-....-####-............
    arr[8] = (v = parseInt(uuid.slice(19, 23), 16)) >>> 8;
    arr[9] = v & 0xff; // Parse ........-....-....-....-############
    // (Use "/" to avoid 32-bit truncation when bit-shifting high-order bytes)
    arr[10] = (v = parseInt(uuid.slice(24, 36), 16)) / 0x10000000000 & 0xff;
    arr[11] = v / 0x100000000 & 0xff;
    arr[12] = v >>> 24 & 0xff;
    arr[13] = v >>> 16 & 0xff;
    arr[14] = v >>> 8 & 0xff;
    arr[15] = v & 0xff;
    return arr;
}
/* harmony default export */ const esm_node_parse = (parse);

;// ./node_modules/uuid/dist/esm-node/v35.js


function stringToBytes(str) {
    str = unescape(encodeURIComponent(str)); // UTF8 escape
    const bytes = [];
    for (let i = 0; i < str.length; ++i) {
        bytes.push(str.charCodeAt(i));
    }
    return bytes;
}
const DNS = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const URL = '6ba7b811-9dad-11d1-80b4-00c04fd430c8';
function v35(name, version, hashfunc) {
    function generateUUID(value, namespace, buf, offset) {
        var _namespace;
        if (typeof value === 'string') {
            value = stringToBytes(value);
        }
        if (typeof namespace === 'string') {
            namespace = esm_node_parse(namespace);
        }
        if (((_namespace = namespace) === null || _namespace === void 0 ? void 0 : _namespace.length) !== 16) {
            throw TypeError('Namespace must be array-like (16 iterable integer values, 0-255)');
        } // Compute hash of namespace and value, Per 4.3
        // Future: Use spread syntax when supported on all platforms, e.g. `bytes =
        // hashfunc([...namespace, ... value])`
        let bytes = new Uint8Array(16 + value.length);
        bytes.set(namespace);
        bytes.set(value, namespace.length);
        bytes = hashfunc(bytes);
        bytes[6] = bytes[6] & 0x0f | version;
        bytes[8] = bytes[8] & 0x3f | 0x80;
        if (buf) {
            offset = offset || 0;
            for (let i = 0; i < 16; ++i) {
                buf[offset + i] = bytes[i];
            }
            return buf;
        }
        return unsafeStringify(bytes);
    } // Function#name is not settable on some platforms (#270)
    try {
        generateUUID.name = name; // eslint-disable-next-line no-empty
    }
    catch (err) { } // For CommonJS default export support
    generateUUID.DNS = DNS;
    generateUUID.URL = URL;
    return generateUUID;
}

;// ./node_modules/uuid/dist/esm-node/md5.js

function md5(bytes) {
    if (Array.isArray(bytes)) {
        bytes = Buffer.from(bytes);
    }
    else if (typeof bytes === 'string') {
        bytes = Buffer.from(bytes, 'utf8');
    }
    return external_crypto_default().createHash('md5').update(bytes).digest();
}
/* harmony default export */ const esm_node_md5 = (md5);

;// ./node_modules/uuid/dist/esm-node/v3.js


const v3 = v35('v3', 0x30, esm_node_md5);
/* harmony default export */ const esm_node_v3 = (v3);

;// ./node_modules/uuid/dist/esm-node/native.js

/* harmony default export */ const esm_node_native = ({
    randomUUID: (external_crypto_default()).randomUUID
});

;// ./node_modules/uuid/dist/esm-node/v4.js



function v4(options, buf, offset) {
    if (esm_node_native.randomUUID && !buf && !options) {
        return esm_node_native.randomUUID();
    }
    options = options || {};
    const rnds = options.random || (options.rng || rng)(); // Per 4.4, set bits for version and `clock_seq_hi_and_reserved`
    rnds[6] = rnds[6] & 0x0f | 0x40;
    rnds[8] = rnds[8] & 0x3f | 0x80; // Copy bytes to buffer, if provided
    if (buf) {
        offset = offset || 0;
        for (let i = 0; i < 16; ++i) {
            buf[offset + i] = rnds[i];
        }
        return buf;
    }
    return unsafeStringify(rnds);
}
/* harmony default export */ const esm_node_v4 = (v4);

;// ./node_modules/uuid/dist/esm-node/sha1.js

function sha1(bytes) {
    if (Array.isArray(bytes)) {
        bytes = Buffer.from(bytes);
    }
    else if (typeof bytes === 'string') {
        bytes = Buffer.from(bytes, 'utf8');
    }
    return external_crypto_default().createHash('sha1').update(bytes).digest();
}
/* harmony default export */ const esm_node_sha1 = (sha1);

;// ./node_modules/uuid/dist/esm-node/v5.js


const v5 = v35('v5', 0x50, esm_node_sha1);
/* harmony default export */ const esm_node_v5 = (v5);

;// ./node_modules/uuid/dist/esm-node/nil.js
/* harmony default export */ const nil = ('00000000-0000-0000-0000-000000000000');

;// ./node_modules/uuid/dist/esm-node/version.js

function version(uuid) {
    if (!esm_node_validate(uuid)) {
        throw TypeError('Invalid UUID');
    }
    return parseInt(uuid.slice(14, 15), 16);
}
/* harmony default export */ const esm_node_version = (version);

;// ./node_modules/uuid/dist/esm-node/index.js











/***/ }),

/***/ 231:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.fsCallbackApiList = void 0;
exports.fsCallbackApiList = [
    'access',
    'appendFile',
    'chmod',
    'chown',
    'close',
    'copyFile',
    'createReadStream',
    'createWriteStream',
    'exists',
    'fchmod',
    'fchown',
    'fdatasync',
    'fstat',
    'fsync',
    'ftruncate',
    'futimes',
    'lchmod',
    'lchown',
    'link',
    'lstat',
    'mkdir',
    'mkdtemp',
    'open',
    'read',
    'readv',
    'readdir',
    'readFile',
    'readlink',
    'realpath',
    'rename',
    'rm',
    'rmdir',
    'stat',
    'symlink',
    'truncate',
    'unlink',
    'unwatchFile',
    'utimes',
    'lutimes',
    'watch',
    'watchFile',
    'write',
    'writev',
    'writeFile',
];


/***/ }),

/***/ 281:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AddSubtitleSource = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const subtitle_track_meta_1 = __webpack_require__(6469);
class AddSubtitleSource {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsAddSubtitleSource(bb, obj) {
        return (obj || new AddSubtitleSource()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsAddSubtitleSource(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new AddSubtitleSource()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    url(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    select() {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false;
    }
    name(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 8);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    metadata(obj) {
        const offset = this.bb.__offset(this.bb_pos, 10);
        return offset ? (obj || new subtitle_track_meta_1.SubtitleTrackMeta()).__init(this.bb.__indirect(this.bb_pos + offset), this.bb) : null;
    }
    static startAddSubtitleSource(builder) {
        builder.startObject(4);
    }
    static addUrl(builder, urlOffset) {
        builder.addFieldOffset(0, urlOffset, 0);
    }
    static addSelect(builder, select) {
        builder.addFieldInt8(1, +select, +false);
    }
    static addName(builder, nameOffset) {
        builder.addFieldOffset(2, nameOffset, 0);
    }
    static addMetadata(builder, metadataOffset) {
        builder.addFieldOffset(3, metadataOffset, 0);
    }
    static endAddSubtitleSource(builder) {
        const offset = builder.endObject();
        builder.requiredField(offset, 4); // url
        return offset;
    }
}
exports.AddSubtitleSource = AddSubtitleSource;


/***/ }),

/***/ 324:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PlaybackState = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
var PlaybackState;
(function (PlaybackState) {
    PlaybackState[PlaybackState["Idle"] = 0] = "Idle";
    PlaybackState[PlaybackState["Buffering"] = 1] = "Buffering";
    PlaybackState[PlaybackState["Playing"] = 2] = "Playing";
    PlaybackState[PlaybackState["Paused"] = 3] = "Paused";
    PlaybackState[PlaybackState["Ended"] = 4] = "Ended";
})(PlaybackState || (exports.PlaybackState = PlaybackState = {}));


/***/ }),

/***/ 528:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Chapter = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const time_1 = __webpack_require__(6004);
class Chapter {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsChapter(bb, obj) {
        return (obj || new Chapter()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsChapter(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new Chapter()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    start(obj) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? (obj || new time_1.Time()).__init(this.bb_pos + offset, this.bb) : null;
    }
    length(obj) {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? (obj || new time_1.Time()).__init(this.bb_pos + offset, this.bb) : null;
    }
    title(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 8);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    skipLabel(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 10);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    static startChapter(builder) {
        builder.startObject(4);
    }
    static addStart(builder, startOffset) {
        builder.addFieldStruct(0, startOffset, 0);
    }
    static addLength(builder, lengthOffset) {
        builder.addFieldStruct(1, lengthOffset, 0);
    }
    static addTitle(builder, titleOffset) {
        builder.addFieldOffset(2, titleOffset, 0);
    }
    static addSkipLabel(builder, skipLabelOffset) {
        builder.addFieldOffset(3, skipLabelOffset, 0);
    }
    static endChapter(builder) {
        const offset = builder.endObject();
        builder.requiredField(offset, 8); // title
        return offset;
    }
}
exports.Chapter = Chapter;


/***/ }),

/***/ 529:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MediaCache = void 0;
const UtilityBackend_1 = __webpack_require__(8819);
const Logger_1 = __webpack_require__(1943);
const memfs_1 = __webpack_require__(5965);
const uuid_1 = __webpack_require__(206);
const os = __importStar(__webpack_require__(857));
const logger = new Logger_1.Logger('MediaCache', Logger_1.LoggerType.BACKEND);
class CacheObject {
    constructor() {
        this.id = (0, uuid_1.v4)();
        this.size = 0;
        this.path = `/cache/${this.id}`;
        this.url = `app://${this.path}`;
    }
}
class MediaCache {
    constructor(playlist) {
        MediaCache.instance = this;
        this.playlist = playlist;
        this.playlistIndex = playlist.offset ? playlist.offset : 0;
        this.cache = new Map();
        this.cacheUrlMap = new Map();
        this.cacheSize = 0;
        this.cacheWindowStart = 0;
        this.cacheWindowEnd = 0;
        this.pendingDownloads = new Set();
        this.isDownloading = false;
        this.destroyed = false;
        if (!memfs_1.fs.existsSync('/cache')) {
            memfs_1.fs.mkdirSync('/cache');
        }
        // @ts-ignore
        if (false) {}
        else if (true) {
            this.quota = Math.min(Math.floor(os.freemem() / 4), 250 * 1024 * 1024); // 250MB
        }
        else {}
        logger.info('Created cache with storage byte quota:', this.quota);
    }
    destroy() {
        this.cache.forEach((item) => { memfs_1.fs.unlinkSync(item.path); });
        MediaCache.instance = null;
        this.cache.clear();
        this.cacheUrlMap.clear();
        this.playlist = null;
        this.quota = 0;
        this.cacheSize = 0;
        this.cacheWindowStart = 0;
        this.cacheWindowEnd = 0;
        this.pendingDownloads.clear();
        this.isDownloading = false;
        this.destroyed = true;
    }
    static getInstance() {
        return MediaCache.instance;
    }
    has(playlistIndex) {
        return this.cache.has(playlistIndex);
    }
    getUrl(playlistIndex) {
        return this.cache.get(playlistIndex).url;
    }
    getObject(url, start = 0, end = null) {
        const cacheObject = this.cache.get(this.cacheUrlMap.get(url));
        end = end ? end : cacheObject.size - 1;
        return memfs_1.fs.createReadStream(cacheObject.path, { start: start, end: end });
    }
    getObjectSize(url) {
        return this.cache.get(this.cacheUrlMap.get(url)).size;
    }
    cacheItems(playlistIndex) {
        this.playlistIndex = playlistIndex;
        if (this.playlist.forwardCache && this.playlist.forwardCache > 0) {
            let cacheAmount = this.playlist.forwardCache;
            for (let i = playlistIndex + 1; i < this.playlist.items.length; i++) {
                if (cacheAmount === 0) {
                    break;
                }
                if (this.playlist.items[i].cache) {
                    cacheAmount--;
                    if (!this.cache.has(i)) {
                        this.pendingDownloads.add(i);
                    }
                }
            }
        }
        if (this.playlist.backwardCache && this.playlist.backwardCache > 0) {
            let cacheAmount = this.playlist.backwardCache;
            for (let i = playlistIndex - 1; i >= 0; i--) {
                if (cacheAmount === 0) {
                    break;
                }
                if (this.playlist.items[i].cache) {
                    cacheAmount--;
                    if (!this.cache.has(i)) {
                        this.pendingDownloads.add(i);
                    }
                }
            }
        }
        this.updateCacheWindow();
        if (!this.isDownloading) {
            this.isDownloading = true;
            this.downloadItems();
        }
    }
    downloadItems() {
        if (this.pendingDownloads.size > 0) {
            let itemIndex = 0;
            let minDistance = this.playlist.items.length;
            for (let i of this.pendingDownloads.values()) {
                if (Math.abs(this.playlistIndex - i) < minDistance) {
                    minDistance = Math.abs(this.playlistIndex - i);
                    itemIndex = i;
                }
                else if (Math.abs(this.playlistIndex - i) === minDistance && i > this.playlistIndex) {
                    itemIndex = i;
                }
            }
            this.pendingDownloads.delete(itemIndex);
            // Due to downloads being async, pending downloads can become out-of-sync with the current playlist index/target cache window
            if (!this.shouldDownloadItem(itemIndex)) {
                logger.debug(`Discarding download index ${itemIndex} since its outside cache window [${this.cacheWindowStart} - ${this.cacheWindowEnd}]`);
                this.downloadItems();
                return;
            }
            const tempCacheObject = new CacheObject();
            (0, UtilityBackend_1.downloadFile)(this.playlist.items[itemIndex].url, tempCacheObject.path, true, this.playlist.items[itemIndex].headers, (downloadedBytes) => {
                // Case occurs when user changes playlist while items are still downloading in the old media cache instance
                if (this.destroyed) {
                    logger.warn('MediaCache instance destroyed, aborting download');
                    return false;
                }
                let underQuota = true;
                if (this.cacheSize + downloadedBytes > this.quota) {
                    underQuota = this.purgeCacheItems(itemIndex, downloadedBytes);
                }
                return underQuota;
            }, null)
                .then(() => {
                if (this.destroyed) {
                    memfs_1.fs.unlinkSync(tempCacheObject.path);
                    return;
                }
                this.finalizeCacheItem(tempCacheObject, itemIndex);
                this.downloadItems();
            }, (error) => {
                logger.warn(error);
                if (!this.destroyed) {
                    this.downloadItems();
                }
            });
        }
        else {
            this.isDownloading = false;
        }
    }
    shouldDownloadItem(index) {
        let download = false;
        if (index > this.playlistIndex) {
            if (this.playlist.forwardCache && this.playlist.forwardCache > 0) {
                const indexList = [...this.cache.keys(), index].sort((a, b) => a - b);
                let forwardCacheItems = this.playlist.forwardCache;
                for (let i of indexList) {
                    if (i > this.playlistIndex) {
                        forwardCacheItems--;
                        if (i === index) {
                            download = true;
                        }
                        else if (forwardCacheItems === 0) {
                            break;
                        }
                    }
                }
            }
        }
        else if (index < this.playlistIndex) {
            if (this.playlist.backwardCache && this.playlist.backwardCache > 0) {
                const indexList = [...this.cache.keys(), index].sort((a, b) => b - a);
                let backwardCacheItems = this.playlist.backwardCache;
                for (let i of indexList) {
                    if (i < this.playlistIndex) {
                        backwardCacheItems--;
                        if (i === index) {
                            download = true;
                        }
                        else if (backwardCacheItems === 0) {
                            break;
                        }
                    }
                }
            }
        }
        return download;
    }
    purgeCacheItems(downloadItem, downloadedBytes) {
        let underQuota = true;
        while (this.cacheSize + downloadedBytes > this.quota) {
            let purgeIndex = this.playlistIndex;
            let purgeDistance = 0;
            logger.debug(`Downloading item ${downloadItem} with playlist index ${this.playlistIndex} and cache window: [${this.cacheWindowStart} - ${this.cacheWindowEnd}]`);
            // Priority:
            // 1. Purge first encountered item outside cache window
            // 2. Purge item furthest from view index inside window (except next item from view index)
            for (let index of this.cache.keys()) {
                if (index === downloadItem || index === this.playlistIndex || index === this.playlistIndex + 1) {
                    continue;
                }
                if (index < this.cacheWindowStart || index > this.cacheWindowEnd) {
                    purgeIndex = index;
                    break;
                }
                else if (Math.abs(this.playlistIndex - index) > purgeDistance) {
                    purgeDistance = Math.abs(this.playlistIndex - index);
                    purgeIndex = index;
                }
            }
            if (purgeIndex !== this.playlistIndex) {
                const deleteItem = this.cache.get(purgeIndex);
                memfs_1.fs.unlinkSync(deleteItem.path);
                this.cacheSize -= deleteItem.size;
                this.cacheUrlMap.delete(deleteItem.url);
                this.cache.delete(purgeIndex);
                this.updateCacheWindow();
                logger.info(`Item ${downloadItem} pending download (${downloadedBytes} bytes) cannot fit in cache, purging ${purgeIndex} from cache. Remaining quota ${this.quota - this.cacheSize} bytes`);
            }
            else {
                // Cannot purge current item since we may already be streaming it
                logger.warn(`Aborting item caching, cannot fit item ${downloadItem} (${downloadedBytes} bytes) within remaining space quota (${this.quota - this.cacheSize} bytes)`);
                underQuota = false;
                break;
            }
        }
        return underQuota;
    }
    finalizeCacheItem(cacheObject, index) {
        const size = memfs_1.fs.statSync(cacheObject.path).size;
        cacheObject.size = size;
        this.cacheSize += size;
        logger.info(`Cached item ${index} (${cacheObject.size} bytes) with remaining quota ${this.quota - this.cacheSize} bytes: ${cacheObject.url}`);
        this.cache.set(index, cacheObject);
        this.cacheUrlMap.set(cacheObject.url, index);
        this.updateCacheWindow();
    }
    updateCacheWindow() {
        const indexList = [...this.cache.keys()].sort((a, b) => a - b);
        if (this.playlist.forwardCache && this.playlist.forwardCache > 0) {
            let forwardCacheItems = this.playlist.forwardCache;
            for (let index of indexList) {
                if (index > this.playlistIndex) {
                    forwardCacheItems--;
                    if (forwardCacheItems === 0) {
                        this.cacheWindowEnd = index;
                        break;
                    }
                }
            }
        }
        else {
            this.cacheWindowEnd = this.playlistIndex;
        }
        if (this.playlist.backwardCache && this.playlist.backwardCache > 0) {
            let backwardCacheItems = this.playlist.backwardCache;
            for (let index of indexList) {
                if (index < this.playlistIndex) {
                    backwardCacheItems--;
                    if (backwardCacheItems === 0) {
                        this.cacheWindowStart = index;
                        break;
                    }
                }
            }
        }
        else {
            this.cacheWindowStart = this.playlistIndex;
        }
    }
}
exports.MediaCache = MediaCache;
MediaCache.instance = null;


/***/ }),

/***/ 649:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.subtitleRoute = void 0;
exports.subtitleRouteUrl = subtitleRouteUrl;
exports.decodeText = decodeText;
exports.srtToVtt = srtToVtt;
exports.assToVtt = assToVtt;
exports.toVtt = toVtt;
const url = __importStar(__webpack_require__(7016));
const follow_redirects_1 = __webpack_require__(3640);
const Logger_1 = __webpack_require__(1943);
const logger = new Logger_1.Logger('Subtitles', Logger_1.LoggerType.BACKEND);
// External subtitles (v4 `AddSubtitleSource`). The TV's player only renders WebVTT, so the pages
// load subtitles through `/subtitle?url=...` here, which fetches the file and converts SRT and
// ASS/SSA to WebVTT.
const MAX_SUBTITLE_BYTES = 8 * 1024 * 1024;
const FETCH_TIMEOUT_MS = 20000;
function subtitleRouteUrl(base, source) {
    return `${base}/subtitle?url=${encodeURIComponent(source)}`;
}
function fetchBytes(source, redirectsLeft = 5) {
    if (source.startsWith('data:')) {
        const comma = source.indexOf(',');
        if (comma < 0) {
            return Promise.reject(new Error('malformed data URL'));
        }
        const meta = source.substring(5, comma);
        const payload = source.substring(comma + 1);
        return Promise.resolve(/;base64$/i.test(meta) ? Buffer.from(payload, 'base64') : Buffer.from(decodeURIComponent(payload), 'utf8'));
    }
    return new Promise((resolve, reject) => {
        const protocol = source.startsWith('https:') ? follow_redirects_1.https : source.startsWith('http:') ? follow_redirects_1.http : null;
        if (!protocol) {
            reject(new Error(`unsupported subtitle URL ${source}`));
            return;
        }
        const request = protocol.get({ ...url.parse(source), maxRedirects: redirectsLeft, timeout: FETCH_TIMEOUT_MS }, (response) => {
            if (response.statusCode < 200 || response.statusCode >= 300) {
                response.resume();
                reject(new Error(`HTTP ${response.statusCode}`));
                return;
            }
            const chunks = [];
            let length = 0;
            response.on('data', (chunk) => {
                length += chunk.length;
                if (length > MAX_SUBTITLE_BYTES) {
                    request.destroy();
                    reject(new Error('subtitle file too large'));
                    return;
                }
                chunks.push(chunk);
            });
            response.on('end', () => resolve(Buffer.concat(chunks)));
            response.on('error', reject);
        });
        request.on('timeout', () => request.destroy(new Error('timed out')));
        request.on('error', reject);
    });
}
// Subtitle files come in all sorts of encodings. Handles BOMs and UTF-8, and falls back to
// Windows-1252 (as Latin-1, which differs only in a few punctuation marks).
function decodeText(data) {
    if (data.length >= 3 && data[0] === 0xef && data[1] === 0xbb && data[2] === 0xbf) {
        return data.toString('utf8', 3);
    }
    if (data.length >= 2 && data[0] === 0xff && data[1] === 0xfe) {
        return data.toString('utf16le', 2);
    }
    if (data.length >= 2 && data[0] === 0xfe && data[1] === 0xff) {
        const swapped = Buffer.from(data.subarray(2));
        swapped.swap16();
        return swapped.toString('utf16le');
    }
    const text = data.toString('utf8');
    // U+FFFD in the output without the bytes for it in the input means invalid UTF-8.
    if (text.indexOf('\ufffd') >= 0 && data.indexOf(Buffer.from([0xef, 0xbf, 0xbd])) < 0) {
        return data.toString('latin1');
    }
    return text;
}
function escapeCueText(text) {
    return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
// Keeps the tags WebVTT shares with SRT (<b>, <i>, <u>) and drops the rest, e.g. <font>.
function cleanSrtText(text) {
    return text
        .replace(/\{\\[^}]*\}/g, '')
        .replace(/<(\/?)([biu])>/gi, '\ue000$1$2\ue001')
        .replace(/<[^>]*>/g, '')
        .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
        .replace(/\ue000/g, '<').replace(/\ue001/g, '>')
        .replace(/-->/g, '--&gt;');
}
const SRT_TIMING = /^\s*(\d+):(\d{1,2}):(\d{1,2})[,.](\d{1,3})\s*-->\s*(\d+):(\d{1,2}):(\d{1,2})[,.](\d{1,3})/;
function vttTime(hours, minutes, seconds, millis) {
    const pad = (value, width) => String(value).padStart(width, '0');
    return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}.${pad(String(millis).padEnd(3, '0').substring(0, 3), 3)}`;
}
function srtToVtt(text) {
    const blocks = text.replace(/\r\n?/g, '\n').split(/\n{2,}/);
    const cues = [];
    for (const block of blocks) {
        const lines = block.split('\n').filter((line, index) => index > 0 || line.trim() !== '');
        const timingIndex = lines.findIndex((line) => SRT_TIMING.test(line));
        if (timingIndex < 0) {
            continue;
        }
        const t = SRT_TIMING.exec(lines[timingIndex]);
        const timing = `${vttTime(t[1], t[2], t[3], t[4].padEnd(3, '0'))} --> ${vttTime(t[5], t[6], t[7], t[8].padEnd(3, '0'))}`;
        const body = lines.slice(timingIndex + 1).map(cleanSrtText).join('\n').trim();
        if (body.length > 0) {
            cues.push(`${timing}\n${body}`);
        }
    }
    return `WEBVTT\n\n${cues.join('\n\n')}\n`;
}
function assTimeToSeconds(value) {
    const match = /^(\d+):(\d{1,2}):(\d{1,2})(?:[.,](\d{1,3}))?$/.exec(value.trim());
    if (!match) {
        return NaN;
    }
    const fraction = match[4] ? Number(`0.${match[4]}`) : 0;
    return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]) + fraction;
}
function secondsToVtt(seconds) {
    const millis = Math.round(seconds * 1000);
    return vttTime(Math.floor(millis / 3600000), Math.floor(millis / 60000) % 60, Math.floor(millis / 1000) % 60, millis % 1000);
}
// ASS/SSA to WebVTT: dialogue text only, styling and positioning are dropped (except italics
// and bold overrides, which WebVTT can express).
function assToVtt(text) {
    const lines = text.replace(/\r\n?/g, '\n').split('\n');
    let inEvents = false;
    let format = null;
    const cues = [];
    for (const raw of lines) {
        const line = raw.trim();
        if (/^\[.*\]$/.test(line)) {
            inEvents = line.toLowerCase() === '[events]';
            continue;
        }
        if (!inEvents) {
            continue;
        }
        const colon = line.indexOf(':');
        if (colon < 0) {
            continue;
        }
        const key = line.substring(0, colon).trim().toLowerCase();
        const value = line.substring(colon + 1);
        if (key === 'format') {
            format = value.split(',').map((field) => field.trim().toLowerCase());
            continue;
        }
        if (key !== 'dialogue') {
            continue;
        }
        const fields = format || ['layer', 'start', 'end', 'style', 'name', 'marginl', 'marginr', 'marginv', 'effect', 'text'];
        const parts = value.split(',');
        const textIndex = fields.indexOf('text');
        if (textIndex < 0 || parts.length < fields.length) {
            continue;
        }
        const get = (name) => parts[fields.indexOf(name)];
        const start = assTimeToSeconds(get('start'));
        const end = assTimeToSeconds(get('end'));
        if (isNaN(start) || isNaN(end) || end <= start) {
            continue;
        }
        let body = parts.slice(textIndex).join(',');
        let italic = false;
        let bold = false;
        body = body.replace(/\{([^}]*)\}/g, (_match, overrides) => {
            let out = '';
            const italicMatch = /\\i([01])/.exec(overrides);
            if (italicMatch && (italicMatch[1] === '1') !== italic) {
                italic = !italic;
                out += italic ? '\ue000i\ue001' : '\ue000/i\ue001';
            }
            const boldMatch = /\\b([01])/.exec(overrides);
            if (boldMatch && (boldMatch[1] === '1') !== bold) {
                bold = !bold;
                out += bold ? '\ue000b\ue001' : '\ue000/b\ue001';
            }
            return out;
        });
        body = escapeCueText(body.replace(/\\N/gi, '\n').replace(/\\h/g, '\u00a0'))
            .replace(/\ue000/g, '<').replace(/\ue001/g, '>');
        if (bold) {
            body += '</b>';
        }
        if (italic) {
            body += '</i>';
        }
        body = body.split('\n').map((l) => l.trim()).join('\n').trim();
        if (body.length > 0) {
            cues.push({ start: start, end: end, text: body });
        }
    }
    cues.sort((a, b) => a.start - b.start);
    return `WEBVTT\n\n${cues.map((cue) => `${secondsToVtt(cue.start)} --> ${secondsToVtt(cue.end)}\n${cue.text}`).join('\n\n')}\n`;
}
function toVtt(text) {
    const trimmed = text.replace(/^\ufeff/, '').replace(/^\s+/, '');
    if (/^WEBVTT/.test(trimmed)) {
        return trimmed;
    }
    if (/^\[Script Info\]/im.test(trimmed) || /^\[Events\]/im.test(trimmed)) {
        return assToVtt(trimmed);
    }
    return srtToVtt(trimmed);
}
const subtitleRoute = (req, res) => {
    const parsed = url.parse(req.url || '', true);
    if (parsed.pathname !== '/subtitle') {
        return false;
    }
    const source = typeof parsed.query.url === 'string' ? parsed.query.url : null;
    if (!source) {
        res.writeHead(400);
        res.end();
        return true;
    }
    fetchBytes(source)
        .then((data) => {
        const vtt = Buffer.from(toVtt(decodeText(data)), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/vtt; charset=utf-8', 'Content-Length': vtt.length });
        res.end(req.method === 'HEAD' ? undefined : vtt);
    })
        .catch((e) => {
        logger.warn(`Could not load subtitles from ${source}`, e);
        res.writeHead(502);
        res.end();
    });
    return true;
};
exports.subtitleRoute = subtitleRoute;


/***/ }),

/***/ 756:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.RequestHeader = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class RequestHeader {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsRequestHeader(bb, obj) {
        return (obj || new RequestHeader()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsRequestHeader(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new RequestHeader()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    key(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    value(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    static startRequestHeader(builder) {
        builder.startObject(2);
    }
    static addKey(builder, keyOffset) {
        builder.addFieldOffset(0, keyOffset, 0);
    }
    static addValue(builder, valueOffset) {
        builder.addFieldOffset(1, valueOffset, 0);
    }
    static endRequestHeader(builder) {
        const offset = builder.endObject();
        builder.requiredField(offset, 4); // key
        builder.requiredField(offset, 6); // value
        return offset;
    }
    static createRequestHeader(builder, keyOffset, valueOffset) {
        RequestHeader.startRequestHeader(builder);
        RequestHeader.addKey(builder, keyOffset);
        RequestHeader.addValue(builder, valueOffset);
        return RequestHeader.endRequestHeader(builder);
    }
}
exports.RequestHeader = RequestHeader;


/***/ }),

/***/ 813:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VideoResolution = void 0;
class VideoResolution {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    width() {
        return this.bb.readUint32(this.bb_pos);
    }
    height() {
        return this.bb.readUint32(this.bb_pos + 4);
    }
    static sizeOf() {
        return 8;
    }
    static createVideoResolution(builder, width, height) {
        builder.prep(4, 8);
        builder.writeInt32(height);
        builder.writeInt32(width);
        return builder.offset();
    }
}
exports.VideoResolution = VideoResolution;


/***/ }),

/***/ 834:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.EventMessage = exports.KeyEvent = exports.MediaItemEvent = exports.UnsubscribeEventMessage = exports.SubscribeEventMessage = exports.KeyUpEvent = exports.KeyDownEvent = exports.MediaItemChangeEvent = exports.MediaItemEndEvent = exports.MediaItemStartEvent = exports.SetPlaylistItemMessage = exports.PlayUpdateMessage = exports.InitialReceiverMessage = exports.ReceiverCapabilities = exports.AVCapabilities = exports.LivestreamCapabilities = exports.InitialSenderMessage = exports.PlaylistContent = exports.MediaItem = exports.VersionMessage = exports.SetSpeedMessage = exports.PlaybackErrorMessage = exports.SetVolumeMessage = exports.VolumeUpdateMessage = exports.PlaybackUpdateMessage = exports.SeekMessage = exports.PlayMessage = exports.GenericMediaMetadata = exports.KeyNames = exports.EventType = exports.MetadataType = exports.ContentType = exports.PlaybackState = exports.Opcode = exports.V4_PROTOCOL_VERSION = exports.PROTOCOL_VERSION = void 0;
// Protocol Documentation: https://gitlab.futo.org/videostreaming/fcast/-/wikis/Protocol-version-3
// Highest version of the JSON protocol (v1-v3). Version 4 is FlatBuffers over TLS, see v4/.
exports.PROTOCOL_VERSION = 3;
exports.V4_PROTOCOL_VERSION = 4;
var Opcode;
(function (Opcode) {
    Opcode[Opcode["None"] = 0] = "None";
    Opcode[Opcode["Play"] = 1] = "Play";
    Opcode[Opcode["Pause"] = 2] = "Pause";
    Opcode[Opcode["Resume"] = 3] = "Resume";
    Opcode[Opcode["Stop"] = 4] = "Stop";
    Opcode[Opcode["Seek"] = 5] = "Seek";
    Opcode[Opcode["PlaybackUpdate"] = 6] = "PlaybackUpdate";
    Opcode[Opcode["VolumeUpdate"] = 7] = "VolumeUpdate";
    Opcode[Opcode["SetVolume"] = 8] = "SetVolume";
    Opcode[Opcode["PlaybackError"] = 9] = "PlaybackError";
    Opcode[Opcode["SetSpeed"] = 10] = "SetSpeed";
    Opcode[Opcode["Version"] = 11] = "Version";
    Opcode[Opcode["Ping"] = 12] = "Ping";
    Opcode[Opcode["Pong"] = 13] = "Pong";
    Opcode[Opcode["Initial"] = 14] = "Initial";
    Opcode[Opcode["PlayUpdate"] = 15] = "PlayUpdate";
    Opcode[Opcode["SetPlaylistItem"] = 16] = "SetPlaylistItem";
    Opcode[Opcode["SubscribeEvent"] = 17] = "SubscribeEvent";
    Opcode[Opcode["UnsubscribeEvent"] = 18] = "UnsubscribeEvent";
    Opcode[Opcode["Event"] = 19] = "Event";
    Opcode[Opcode["Flatbuf"] = 20] = "Flatbuf";
    Opcode[Opcode["Resource"] = 21] = "Resource";
})(Opcode || (exports.Opcode = Opcode = {}));
;
var PlaybackState;
(function (PlaybackState) {
    PlaybackState[PlaybackState["Idle"] = 0] = "Idle";
    PlaybackState[PlaybackState["Playing"] = 1] = "Playing";
    PlaybackState[PlaybackState["Paused"] = 2] = "Paused";
})(PlaybackState || (exports.PlaybackState = PlaybackState = {}));
var ContentType;
(function (ContentType) {
    ContentType[ContentType["Playlist"] = 0] = "Playlist";
})(ContentType || (exports.ContentType = ContentType = {}));
var MetadataType;
(function (MetadataType) {
    MetadataType[MetadataType["Generic"] = 0] = "Generic";
})(MetadataType || (exports.MetadataType = MetadataType = {}));
var EventType;
(function (EventType) {
    EventType[EventType["MediaItemStart"] = 0] = "MediaItemStart";
    EventType[EventType["MediaItemEnd"] = 1] = "MediaItemEnd";
    EventType[EventType["MediaItemChange"] = 2] = "MediaItemChange";
    EventType[EventType["KeyDown"] = 3] = "KeyDown";
    EventType[EventType["KeyUp"] = 4] = "KeyUp";
})(EventType || (exports.EventType = EventType = {}));
// Required supported keys for listener events defined below.
// Optionally supported key values list: https://developer.mozilla.org/en-US/docs/Web/API/UI_Events/Keyboard_event_key_values
var KeyNames;
(function (KeyNames) {
    KeyNames["Left"] = "ArrowLeft";
    KeyNames["Right"] = "ArrowRight";
    KeyNames["Up"] = "ArrowUp";
    KeyNames["Down"] = "ArrowDown";
    KeyNames["Ok"] = "Enter";
})(KeyNames || (exports.KeyNames = KeyNames = {}));
class GenericMediaMetadata {
    constructor(title = null, thumbnailUrl = null, custom = null) {
        this.title = title;
        this.thumbnailUrl = thumbnailUrl;
        this.custom = custom;
        this.type = MetadataType.Generic;
    }
}
exports.GenericMediaMetadata = GenericMediaMetadata;
class PlayMessage {
    constructor(container, // The MIME type (video/mp4)
    url = null, // The URL to load (optional)
    content = null, // The content to load (i.e. a DASH manifest, json content, optional)
    time = null, // The time to start playing in seconds
    volume = null, // The desired volume (0-1)
    speed = null, // The factor to multiply playback speed by (defaults to 1.0)
    headers = null, // HTTP request headers to add to the play request Map<string, string>
    metadata = null) {
        this.container = container;
        this.url = url;
        this.content = content;
        this.time = time;
        this.volume = volume;
        this.speed = speed;
        this.headers = headers;
        this.metadata = metadata;
    }
}
exports.PlayMessage = PlayMessage;
class SeekMessage {
    constructor(time) {
        this.time = time;
    }
}
exports.SeekMessage = SeekMessage;
class PlaybackUpdateMessage {
    constructor(generationTime, // The time the packet was generated (unix time milliseconds)
    state, // The playback state
    time = null, // The current time playing in seconds
    duration = null, // The duration in seconds
    speed = null, // The playback speed factor
    itemIndex = null) {
        this.generationTime = generationTime;
        this.state = state;
        this.time = time;
        this.duration = duration;
        this.speed = speed;
        this.itemIndex = itemIndex;
    }
}
exports.PlaybackUpdateMessage = PlaybackUpdateMessage;
class VolumeUpdateMessage {
    constructor(generationTime, // The time the packet was generated (unix time milliseconds)
    volume) {
        this.generationTime = generationTime;
        this.volume = volume;
    }
}
exports.VolumeUpdateMessage = VolumeUpdateMessage;
class SetVolumeMessage {
    constructor(volume) {
        this.volume = volume;
    }
}
exports.SetVolumeMessage = SetVolumeMessage;
class PlaybackErrorMessage {
    constructor(message) {
        this.message = message;
    }
}
exports.PlaybackErrorMessage = PlaybackErrorMessage;
class SetSpeedMessage {
    constructor(speed) {
        this.speed = speed;
    }
}
exports.SetSpeedMessage = SetSpeedMessage;
class VersionMessage {
    constructor(version) {
        this.version = version;
    }
}
exports.VersionMessage = VersionMessage;
class MediaItem {
    constructor(container, // The MIME type (video/mp4)
    url = null, // The URL to load (optional)
    content = null, // The content to load (i.e. a DASH manifest, json content, optional)
    time = null, // The time to start playing in seconds
    volume = null, // The desired volume (0-1)
    speed = null, // The factor to multiply playback speed by (defaults to 1.0)
    cache = null, // Indicates if the receiver should preload the media item
    showDuration = null, // Indicates how long the item content is presented on screen in seconds
    headers = null, // HTTP request headers to add to the play request Map<string, string>
    metadata = null) {
        this.container = container;
        this.url = url;
        this.content = content;
        this.time = time;
        this.volume = volume;
        this.speed = speed;
        this.cache = cache;
        this.showDuration = showDuration;
        this.headers = headers;
        this.metadata = metadata;
    }
}
exports.MediaItem = MediaItem;
class PlaylistContent {
    constructor(items, offset = null, // Start position of the first item to play from the playlist
    volume = null, // The desired volume (0-1)
    speed = null, // The factor to multiply playback speed by (defaults to 1.0)
    forwardCache = null, // Count of media items should be pre-loaded forward from the current view index
    backwardCache = null, // Count of media items should be pre-loaded backward from the current view index
    metadata = null) {
        this.items = items;
        this.offset = offset;
        this.volume = volume;
        this.speed = speed;
        this.forwardCache = forwardCache;
        this.backwardCache = backwardCache;
        this.metadata = metadata;
        this.contentType = ContentType.Playlist;
    }
}
exports.PlaylistContent = PlaylistContent;
class InitialSenderMessage {
    constructor(displayName = null, appName = null, appVersion = null) {
        this.displayName = displayName;
        this.appName = appName;
        this.appVersion = appVersion;
    }
}
exports.InitialSenderMessage = InitialSenderMessage;
class LivestreamCapabilities {
    constructor(whep = null) {
        this.whep = whep;
    }
}
exports.LivestreamCapabilities = LivestreamCapabilities;
class AVCapabilities {
    constructor(livestream = null) {
        this.livestream = livestream;
    }
}
exports.AVCapabilities = AVCapabilities;
class ReceiverCapabilities {
    constructor(av = null) {
        this.av = av;
    }
}
exports.ReceiverCapabilities = ReceiverCapabilities;
class InitialReceiverMessage {
    constructor(displayName = null, appName = null, appVersion = null, playData = null, experimentalCapabilities = null) {
        this.displayName = displayName;
        this.appName = appName;
        this.appVersion = appVersion;
        this.playData = playData;
        this.experimentalCapabilities = experimentalCapabilities;
    }
}
exports.InitialReceiverMessage = InitialReceiverMessage;
class PlayUpdateMessage {
    constructor(generationTime, playData = null) {
        this.generationTime = generationTime;
        this.playData = playData;
    }
}
exports.PlayUpdateMessage = PlayUpdateMessage;
class SetPlaylistItemMessage {
    constructor(itemIndex) {
        this.itemIndex = itemIndex;
    }
}
exports.SetPlaylistItemMessage = SetPlaylistItemMessage;
class MediaItemStartEvent {
    constructor() {
        this.type = EventType.MediaItemStart;
    }
}
exports.MediaItemStartEvent = MediaItemStartEvent;
class MediaItemEndEvent {
    constructor() {
        this.type = EventType.MediaItemEnd;
    }
}
exports.MediaItemEndEvent = MediaItemEndEvent;
class MediaItemChangeEvent {
    constructor() {
        this.type = EventType.MediaItemChange;
    }
}
exports.MediaItemChangeEvent = MediaItemChangeEvent;
class KeyDownEvent {
    constructor(keys) {
        this.keys = keys;
        this.type = EventType.KeyDown;
    }
}
exports.KeyDownEvent = KeyDownEvent;
class KeyUpEvent {
    constructor(keys) {
        this.keys = keys;
        this.type = EventType.KeyUp;
    }
}
exports.KeyUpEvent = KeyUpEvent;
class SubscribeEventMessage {
    constructor(event) {
        this.event = event;
    }
}
exports.SubscribeEventMessage = SubscribeEventMessage;
class UnsubscribeEventMessage {
    constructor(event) {
        this.event = event;
    }
}
exports.UnsubscribeEventMessage = UnsubscribeEventMessage;
class MediaItemEvent {
    constructor(type, item) {
        this.type = type;
        this.item = item;
    }
}
exports.MediaItemEvent = MediaItemEvent;
class KeyEvent {
    constructor(type, key, repeat, handled) {
        this.type = type;
        this.key = key;
        this.repeat = repeat;
        this.handled = handled;
    }
}
exports.KeyEvent = KeyEvent;
class EventMessage {
    constructor(generationTime, event) {
        this.generationTime = generationTime;
        this.event = event;
    }
}
exports.EventMessage = EventMessage;


/***/ }),

/***/ 857:
/***/ ((module) => {

"use strict";
module.exports = require("os");

/***/ }),

/***/ 926:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.IpcServer = exports.IPC_PORT = void 0;
const http = __importStar(__webpack_require__(8611));
const Logger_1 = __webpack_require__(1943);
const logger = new Logger_1.Logger('Ipc', Logger_1.LoggerType.BACKEND);
// Local channel between this service and the module's pages, which TizenBrew serves from
// http://127.0.0.1:8081 (a different origin, hence CORS). Replaces upstream's Tizen MessagePort
// (C# service) and webOS Luna bus:
//   GET  /events        Server-Sent Events stream of service events (`event:` name, JSON `data:`)
//   POST /call/<method> JSON request body, JSON response `{ "value": ... }` or `{ "error": ... }`
//   other GETs          `routes`, e.g. media served by senders (FCompanion) and converted subtitles
// Only bound to 127.0.0.1, so senders on the network can't reach it.
exports.IPC_PORT = 46897;
class IpcServer {
    constructor(handler) {
        this.handler = handler;
        this.server = null;
        this.clients = new Set();
        this.keepAlive = null;
        // Called with each new event-stream client, e.g. to replay state the page needs on load.
        this.onClientConnected = null;
        this.routes = [];
    }
    start(port = exports.IPC_PORT) {
        this.server = http.createServer((req, res) => this.handleRequest(req, res));
        this.server.on('error', (err) => logger.error('IPC server error', err));
        this.server.listen(port, '127.0.0.1');
        // Comment lines keep idle event streams from being timed out by proxies or the browser.
        this.keepAlive = setInterval(() => this.clients.forEach((client) => client.write(': keep-alive\n\n')), 15000);
    }
    stop() {
        var _a;
        clearInterval(this.keepAlive);
        this.clients.forEach((client) => client.end());
        this.clients.clear();
        (_a = this.server) === null || _a === void 0 ? void 0 : _a.close();
    }
    get port() {
        const address = this.server ? this.server.address() : null;
        return address && typeof address === 'object' ? address.port : null;
    }
    hasClients() {
        return this.clients.size > 0;
    }
    broadcast(event, value = null) {
        const message = IpcServer.format(event, value);
        this.clients.forEach((client) => client.write(message));
    }
    static format(event, value) {
        return `event: ${event}\ndata: ${JSON.stringify(value === undefined ? null : value)}\n\n`;
    }
    handleRequest(req, res) {
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Range');
        res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, POST, OPTIONS');
        // hls.js/dash.js fetch served media with XHR and need these for byte ranges.
        res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges');
        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }
        if (req.method === 'GET' && req.url === '/events') {
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive',
            });
            res.write('retry: 1000\n\n');
            this.clients.add(res);
            req.on('close', () => this.clients.delete(res));
            logger.info(`Page connected (${this.clients.size} connected)`);
            if (this.onClientConnected) {
                try {
                    this.onClientConnected((event, value) => res.write(IpcServer.format(event, value)));
                }
                catch (e) {
                    logger.error('Error replaying state to a new page', e);
                }
            }
            return;
        }
        if (req.method === 'GET' || req.method === 'HEAD') {
            for (const route of this.routes) {
                try {
                    if (route(req, res)) {
                        return;
                    }
                }
                catch (e) {
                    logger.error(`Route ${req.url} failed`, e);
                    if (!res.headersSent) {
                        res.writeHead(500);
                    }
                    res.end();
                    return;
                }
            }
        }
        const match = req.method === 'POST' && req.url ? /^\/call\/([a-z_]+)$/.exec(req.url) : null;
        if (!match) {
            res.writeHead(404);
            res.end();
            return;
        }
        let body = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => { body += chunk; });
        req.on('end', () => {
            const respond = (status, payload) => {
                res.writeHead(status, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(payload));
            };
            let value;
            try {
                value = body.length > 0 ? JSON.parse(body) : null;
            }
            catch (_a) {
                respond(400, { error: 'invalid JSON' });
                return;
            }
            Promise.resolve()
                .then(() => this.handler(match[1], value))
                .then((result) => respond(200, { value: result === undefined ? null : result }))
                .catch((e) => {
                logger.error(`IPC call ${match[1]} failed`, e);
                respond(500, { error: `${e}` });
            });
        });
    }
}
exports.IpcServer = IpcServer;


/***/ }),

/***/ 932:
/***/ ((module) => {

"use strict";
module.exports = require("process");

/***/ }),

/***/ 937:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ReceiverIntroduction = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const device_info_1 = __webpack_require__(5312);
const receiver_capabilities_1 = __webpack_require__(4947);
class ReceiverIntroduction {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsReceiverIntroduction(bb, obj) {
        return (obj || new ReceiverIntroduction()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsReceiverIntroduction(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new ReceiverIntroduction()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    deviceInfo(obj) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? (obj || new device_info_1.DeviceInfo()).__init(this.bb.__indirect(this.bb_pos + offset), this.bb) : null;
    }
    capabilities(obj) {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? (obj || new receiver_capabilities_1.ReceiverCapabilities()).__init(this.bb.__indirect(this.bb_pos + offset), this.bb) : null;
    }
    static startReceiverIntroduction(builder) {
        builder.startObject(2);
    }
    static addDeviceInfo(builder, deviceInfoOffset) {
        builder.addFieldOffset(0, deviceInfoOffset, 0);
    }
    static addCapabilities(builder, capabilitiesOffset) {
        builder.addFieldOffset(1, capabilitiesOffset, 0);
    }
    static endReceiverIntroduction(builder) {
        const offset = builder.endObject();
        builder.requiredField(offset, 4); // device_info
        return offset;
    }
}
exports.ReceiverIntroduction = ReceiverIntroduction;


/***/ }),

/***/ 1085:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ResourceReadHead = void 0;
class ResourceReadHead {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    start() {
        return this.bb.readUint64(this.bb_pos);
    }
    stopInclusive() {
        return this.bb.readUint64(this.bb_pos + 8);
    }
    static sizeOf() {
        return 16;
    }
    static createResourceReadHead(builder, start, stop_inclusive) {
        builder.prep(8, 16);
        builder.writeInt64(BigInt(stop_inclusive !== null && stop_inclusive !== void 0 ? stop_inclusive : 0));
        builder.writeInt64(BigInt(start !== null && start !== void 0 ? start : 0));
        return builder.offset();
    }
}
exports.ResourceReadHead = ResourceReadHead;


/***/ }),

/***/ 1093:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Dirent = void 0;
const constants_1 = __webpack_require__(2612);
const encoding_1 = __webpack_require__(2708);
const { S_IFMT, S_IFDIR, S_IFREG, S_IFBLK, S_IFCHR, S_IFLNK, S_IFIFO, S_IFSOCK } = constants_1.constants;
/**
 * A directory entry, like `fs.Dirent`.
 */
class Dirent {
    constructor() {
        this.name = '';
        this.path = '';
        this.parentPath = '';
        this.mode = 0;
    }
    static build(link, encoding) {
        const dirent = new Dirent();
        const { mode } = link.getNode();
        dirent.name = (0, encoding_1.strToEncoding)(link.getName(), encoding);
        dirent.mode = mode;
        dirent.path = link.getParentPath();
        dirent.parentPath = dirent.path;
        return dirent;
    }
    _checkModeProperty(property) {
        return (this.mode & S_IFMT) === property;
    }
    isDirectory() {
        return this._checkModeProperty(S_IFDIR);
    }
    isFile() {
        return this._checkModeProperty(S_IFREG);
    }
    isBlockDevice() {
        return this._checkModeProperty(S_IFBLK);
    }
    isCharacterDevice() {
        return this._checkModeProperty(S_IFCHR);
    }
    isSymbolicLink() {
        return this._checkModeProperty(S_IFLNK);
    }
    isFIFO() {
        return this._checkModeProperty(S_IFIFO);
    }
    isSocket() {
        return this._checkModeProperty(S_IFSOCK);
    }
}
exports.Dirent = Dirent;
exports["default"] = Dirent;


/***/ }),

/***/ 1162:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AudioCapabilities = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class AudioCapabilities {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsAudioCapabilities(bb, obj) {
        return (obj || new AudioCapabilities()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsAudioCapabilities(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new AudioCapabilities()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    volumeStepInterval() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readFloat32(this.bb_pos + offset) : 0.0;
    }
    static startAudioCapabilities(builder) {
        builder.startObject(1);
    }
    static addVolumeStepInterval(builder, volumeStepInterval) {
        builder.addFieldFloat32(0, volumeStepInterval, 0.0);
    }
    static endAudioCapabilities(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createAudioCapabilities(builder, volumeStepInterval) {
        AudioCapabilities.startAudioCapabilities(builder);
        AudioCapabilities.addVolumeStepInterval(builder, volumeStepInterval);
        return AudioCapabilities.endAudioCapabilities(builder);
    }
}
exports.AudioCapabilities = AudioCapabilities;


/***/ }),

/***/ 1179:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AudioTrackMeta = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class AudioTrackMeta {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsAudioTrackMeta(bb, obj) {
        return (obj || new AudioTrackMeta()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsAudioTrackMeta(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new AudioTrackMeta()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static startAudioTrackMeta(builder) {
        builder.startObject(0);
    }
    static endAudioTrackMeta(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createAudioTrackMeta(builder) {
        AudioTrackMeta.startAudioTrackMeta(builder);
        return AudioTrackMeta.endAudioTrackMeta(builder);
    }
}
exports.AudioTrackMeta = AudioTrackMeta;


/***/ }),

/***/ 1356:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GenericMetaString = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class GenericMetaString {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsGenericMetaString(bb, obj) {
        return (obj || new GenericMetaString()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsGenericMetaString(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new GenericMetaString()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    value(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    static startGenericMetaString(builder) {
        builder.startObject(1);
    }
    static addValue(builder, valueOffset) {
        builder.addFieldOffset(0, valueOffset, 0);
    }
    static endGenericMetaString(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createGenericMetaString(builder, valueOffset) {
        GenericMetaString.startGenericMetaString(builder);
        GenericMetaString.addValue(builder, valueOffset);
        return GenericMetaString.endGenericMetaString(builder);
    }
}
exports.GenericMetaString = GenericMetaString;


/***/ }),

/***/ 1357:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/**
 * Detect Electron renderer / nwjs process, which is node, but we should
 * treat as a browser.
 */
if (typeof process === 'undefined' || process.type === 'renderer' || process.browser === true || process.__nwjs) {
    module.exports = __webpack_require__(4109);
}
else {
    module.exports = __webpack_require__(6181);
}


/***/ }),

/***/ 1392:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MediaTrackType = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
var MediaTrackType;
(function (MediaTrackType) {
    MediaTrackType[MediaTrackType["Video"] = 0] = "Video";
    MediaTrackType[MediaTrackType["Audio"] = 1] = "Audio";
    MediaTrackType[MediaTrackType["Subtitle"] = 2] = "Subtitle";
})(MediaTrackType || (exports.MediaTrackType = MediaTrackType = {}));


/***/ }),

/***/ 1564:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CompanionResourceSize = void 0;
exports.unionToCompanionResourceSize = unionToCompanionResourceSize;
exports.unionListToCompanionResourceSize = unionListToCompanionResourceSize;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const known_resource_size_1 = __webpack_require__(8733);
const unknown_resource_size_1 = __webpack_require__(3772);
var CompanionResourceSize;
(function (CompanionResourceSize) {
    CompanionResourceSize[CompanionResourceSize["NONE"] = 0] = "NONE";
    CompanionResourceSize[CompanionResourceSize["Unknown"] = 1] = "Unknown";
    CompanionResourceSize[CompanionResourceSize["Known"] = 2] = "Known";
})(CompanionResourceSize || (exports.CompanionResourceSize = CompanionResourceSize = {}));
function unionToCompanionResourceSize(type, accessor) {
    switch (CompanionResourceSize[type]) {
        case 'NONE': return null;
        case 'Unknown': return accessor(new unknown_resource_size_1.UnknownResourceSize());
        case 'Known': return accessor(new known_resource_size_1.KnownResourceSize());
        default: return null;
    }
}
function unionListToCompanionResourceSize(type, accessor, index) {
    switch (CompanionResourceSize[type]) {
        case 'NONE': return null;
        case 'Unknown': return accessor(index, new unknown_resource_size_1.UnknownResourceSize());
        case 'Known': return accessor(index, new known_resource_size_1.KnownResourceSize());
        default: return null;
    }
}


/***/ }),

/***/ 1620:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GenericMetaValue = void 0;
exports.unionToGenericMetaValue = unionToGenericMetaValue;
exports.unionListToGenericMetaValue = unionListToGenericMetaValue;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const generic_meta_float_1 = __webpack_require__(8831);
const generic_meta_int_1 = __webpack_require__(9300);
const generic_meta_list_1 = __webpack_require__(8317);
const generic_meta_string_1 = __webpack_require__(1356);
const metadata_kv_1 = __webpack_require__(4560);
var GenericMetaValue;
(function (GenericMetaValue) {
    GenericMetaValue[GenericMetaValue["NONE"] = 0] = "NONE";
    GenericMetaValue[GenericMetaValue["String"] = 1] = "String";
    GenericMetaValue[GenericMetaValue["Float"] = 2] = "Float";
    GenericMetaValue[GenericMetaValue["Int"] = 3] = "Int";
    GenericMetaValue[GenericMetaValue["List"] = 4] = "List";
    GenericMetaValue[GenericMetaValue["KVPair"] = 5] = "KVPair";
})(GenericMetaValue || (exports.GenericMetaValue = GenericMetaValue = {}));
function unionToGenericMetaValue(type, accessor) {
    switch (GenericMetaValue[type]) {
        case 'NONE': return null;
        case 'String': return accessor(new generic_meta_string_1.GenericMetaString());
        case 'Float': return accessor(new generic_meta_float_1.GenericMetaFloat());
        case 'Int': return accessor(new generic_meta_int_1.GenericMetaInt());
        case 'List': return accessor(new generic_meta_list_1.GenericMetaList());
        case 'KVPair': return accessor(new metadata_kv_1.MetadataKV());
        default: return null;
    }
}
function unionListToGenericMetaValue(type, accessor, index) {
    switch (GenericMetaValue[type]) {
        case 'NONE': return null;
        case 'String': return accessor(index, new generic_meta_string_1.GenericMetaString());
        case 'Float': return accessor(index, new generic_meta_float_1.GenericMetaFloat());
        case 'Int': return accessor(index, new generic_meta_int_1.GenericMetaInt());
        case 'List': return accessor(index, new generic_meta_list_1.GenericMetaList());
        case 'KVPair': return accessor(index, new metadata_kv_1.MetadataKV());
        default: return null;
    }
}


/***/ }),

/***/ 1663:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

const Buffer = (__webpack_require__(181).Buffer);
const types = __webpack_require__(7478);
const rcodes = __webpack_require__(147);
const opcodes = __webpack_require__(6712);
const classes = __webpack_require__(5343);
const optioncodes = __webpack_require__(4174);
const ip = __webpack_require__(26);
const QUERY_FLAG = 0;
const RESPONSE_FLAG = 1 << 15;
const FLUSH_MASK = 1 << 15;
const NOT_FLUSH_MASK = ~FLUSH_MASK;
const QU_MASK = 1 << 15;
const NOT_QU_MASK = ~QU_MASK;
const name = exports.name = {};
name.encode = function (str, buf, offset, { mail = false } = {}) {
    if (!buf)
        buf = Buffer.alloc(name.encodingLength(str));
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    // strip leading and trailing .
    const n = str.replace(/^\.|\.$/gm, '');
    if (n.length) {
        let list = [];
        if (mail) {
            let localPart = '';
            n.split('.').forEach(label => {
                if (label.endsWith('\\')) {
                    localPart += (localPart.length ? '.' : '') + label.slice(0, -1);
                }
                else {
                    if (list.length === 0 && localPart.length) {
                        list.push(localPart + '.' + label);
                    }
                    else {
                        list.push(label);
                    }
                }
            });
        }
        else {
            list = n.split('.');
        }
        for (let i = 0; i < list.length; i++) {
            const len = buf.write(list[i], offset + 1);
            buf[offset] = len;
            offset += len + 1;
        }
    }
    buf[offset++] = 0;
    name.encode.bytes = offset - oldOffset;
    return buf;
};
name.encode.bytes = 0;
name.decode = function (buf, offset, { mail = false } = {}) {
    if (!offset)
        offset = 0;
    const list = [];
    let oldOffset = offset;
    let totalLength = 0;
    let consumedBytes = 0;
    let jumped = false;
    while (true) {
        if (offset >= buf.length) {
            throw new Error('Cannot decode name (buffer overflow)');
        }
        const len = buf[offset++];
        consumedBytes += jumped ? 0 : 1;
        if (len === 0) {
            break;
        }
        else if ((len & 0xc0) === 0) {
            if (offset + len > buf.length) {
                throw new Error('Cannot decode name (buffer overflow)');
            }
            totalLength += len + 1;
            if (totalLength > 254) {
                throw new Error('Cannot decode name (name too long)');
            }
            let label = buf.toString('utf-8', offset, offset + len);
            if (mail) {
                label = label.replace(/\./g, '\\.');
            }
            list.push(label);
            offset += len;
            consumedBytes += jumped ? 0 : len;
        }
        else if ((len & 0xc0) === 0xc0) {
            if (offset + 1 > buf.length) {
                throw new Error('Cannot decode name (buffer overflow)');
            }
            const jumpOffset = buf.readUInt16BE(offset - 1) - 0xc000;
            if (jumpOffset >= oldOffset) {
                // Allow only pointers to prior data. RFC 1035, section 4.1.4 states:
                // "[...] an entire domain name or a list of labels at the end of a domain name
                // is replaced with a pointer to a prior occurance (sic) of the same name."
                throw new Error('Cannot decode name (bad pointer)');
            }
            offset = jumpOffset;
            oldOffset = jumpOffset;
            consumedBytes += jumped ? 0 : 1;
            jumped = true;
        }
        else {
            throw new Error('Cannot decode name (bad label)');
        }
    }
    name.decode.bytes = consumedBytes;
    return list.length === 0 ? '.' : list.join('.');
};
name.decode.bytes = 0;
name.encodingLength = function (n) {
    if (n === '.' || n === '..')
        return 1;
    return Buffer.byteLength(n.replace(/^\.|\.$/gm, '')) + 2;
};
const string = {};
string.encode = function (s, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(string.encodingLength(s));
    if (!offset)
        offset = 0;
    const len = buf.write(s, offset + 1);
    buf[offset] = len;
    string.encode.bytes = len + 1;
    return buf;
};
string.encode.bytes = 0;
string.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const len = buf[offset];
    const s = buf.toString('utf-8', offset + 1, offset + 1 + len);
    string.decode.bytes = len + 1;
    return s;
};
string.decode.bytes = 0;
string.encodingLength = function (s) {
    return Buffer.byteLength(s) + 1;
};
const header = {};
header.encode = function (h, buf, offset) {
    if (!buf)
        buf = header.encodingLength(h);
    if (!offset)
        offset = 0;
    const flags = (h.flags || 0) & 32767;
    const type = h.type === 'response' ? RESPONSE_FLAG : QUERY_FLAG;
    buf.writeUInt16BE(h.id || 0, offset);
    buf.writeUInt16BE(flags | type, offset + 2);
    buf.writeUInt16BE(h.questions.length, offset + 4);
    buf.writeUInt16BE(h.answers.length, offset + 6);
    buf.writeUInt16BE(h.authorities.length, offset + 8);
    buf.writeUInt16BE(h.additionals.length, offset + 10);
    return buf;
};
header.encode.bytes = 12;
header.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    if (buf.length < 12)
        throw new Error('Header must be 12 bytes');
    const flags = buf.readUInt16BE(offset + 2);
    return {
        id: buf.readUInt16BE(offset),
        type: flags & RESPONSE_FLAG ? 'response' : 'query',
        flags: flags & 32767,
        flag_qr: ((flags >> 15) & 0x1) === 1,
        opcode: opcodes.toString((flags >> 11) & 0xf),
        flag_aa: ((flags >> 10) & 0x1) === 1,
        flag_tc: ((flags >> 9) & 0x1) === 1,
        flag_rd: ((flags >> 8) & 0x1) === 1,
        flag_ra: ((flags >> 7) & 0x1) === 1,
        flag_z: ((flags >> 6) & 0x1) === 1,
        flag_ad: ((flags >> 5) & 0x1) === 1,
        flag_cd: ((flags >> 4) & 0x1) === 1,
        rcode: rcodes.toString(flags & 0xf),
        questions: new Array(buf.readUInt16BE(offset + 4)),
        answers: new Array(buf.readUInt16BE(offset + 6)),
        authorities: new Array(buf.readUInt16BE(offset + 8)),
        additionals: new Array(buf.readUInt16BE(offset + 10))
    };
};
header.decode.bytes = 12;
header.encodingLength = function () {
    return 12;
};
const runknown = exports.unknown = {};
runknown.encode = function (data, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(runknown.encodingLength(data));
    if (!offset)
        offset = 0;
    buf.writeUInt16BE(data.length, offset);
    data.copy(buf, offset + 2);
    runknown.encode.bytes = data.length + 2;
    return buf;
};
runknown.encode.bytes = 0;
runknown.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const len = buf.readUInt16BE(offset);
    const data = buf.slice(offset + 2, offset + 2 + len);
    runknown.decode.bytes = len + 2;
    return data;
};
runknown.decode.bytes = 0;
runknown.encodingLength = function (data) {
    return data.length + 2;
};
const rns = exports.ns = {};
rns.encode = function (data, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(rns.encodingLength(data));
    if (!offset)
        offset = 0;
    name.encode(data, buf, offset + 2);
    buf.writeUInt16BE(name.encode.bytes, offset);
    rns.encode.bytes = name.encode.bytes + 2;
    return buf;
};
rns.encode.bytes = 0;
rns.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const len = buf.readUInt16BE(offset);
    const dd = name.decode(buf, offset + 2);
    rns.decode.bytes = len + 2;
    return dd;
};
rns.decode.bytes = 0;
rns.encodingLength = function (data) {
    return name.encodingLength(data) + 2;
};
const rsoa = exports.soa = {};
rsoa.encode = function (data, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(rsoa.encodingLength(data));
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    offset += 2;
    name.encode(data.mname, buf, offset);
    offset += name.encode.bytes;
    name.encode(data.rname, buf, offset, { mail: true });
    offset += name.encode.bytes;
    buf.writeUInt32BE(data.serial || 0, offset);
    offset += 4;
    buf.writeUInt32BE(data.refresh || 0, offset);
    offset += 4;
    buf.writeUInt32BE(data.retry || 0, offset);
    offset += 4;
    buf.writeUInt32BE(data.expire || 0, offset);
    offset += 4;
    buf.writeUInt32BE(data.minimum || 0, offset);
    offset += 4;
    buf.writeUInt16BE(offset - oldOffset - 2, oldOffset);
    rsoa.encode.bytes = offset - oldOffset;
    return buf;
};
rsoa.encode.bytes = 0;
rsoa.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    const data = {};
    offset += 2;
    data.mname = name.decode(buf, offset);
    offset += name.decode.bytes;
    data.rname = name.decode(buf, offset, { mail: true });
    offset += name.decode.bytes;
    data.serial = buf.readUInt32BE(offset);
    offset += 4;
    data.refresh = buf.readUInt32BE(offset);
    offset += 4;
    data.retry = buf.readUInt32BE(offset);
    offset += 4;
    data.expire = buf.readUInt32BE(offset);
    offset += 4;
    data.minimum = buf.readUInt32BE(offset);
    offset += 4;
    rsoa.decode.bytes = offset - oldOffset;
    return data;
};
rsoa.decode.bytes = 0;
rsoa.encodingLength = function (data) {
    return 22 + name.encodingLength(data.mname) + name.encodingLength(data.rname);
};
const rtxt = exports.txt = {};
rtxt.encode = function (data, buf, offset) {
    if (!Array.isArray(data))
        data = [data];
    for (let i = 0; i < data.length; i++) {
        if (typeof data[i] === 'string') {
            data[i] = Buffer.from(data[i]);
        }
        if (!Buffer.isBuffer(data[i])) {
            throw new Error('Must be a Buffer');
        }
    }
    if (!buf)
        buf = Buffer.alloc(rtxt.encodingLength(data));
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    offset += 2;
    data.forEach(function (d) {
        buf[offset++] = d.length;
        d.copy(buf, offset, 0, d.length);
        offset += d.length;
    });
    buf.writeUInt16BE(offset - oldOffset - 2, oldOffset);
    rtxt.encode.bytes = offset - oldOffset;
    return buf;
};
rtxt.encode.bytes = 0;
rtxt.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    let remaining = buf.readUInt16BE(offset);
    offset += 2;
    let data = [];
    while (remaining > 0) {
        const len = buf[offset++];
        --remaining;
        if (remaining < len) {
            throw new Error('Buffer overflow');
        }
        data.push(buf.slice(offset, offset + len));
        offset += len;
        remaining -= len;
    }
    rtxt.decode.bytes = offset - oldOffset;
    return data;
};
rtxt.decode.bytes = 0;
rtxt.encodingLength = function (data) {
    if (!Array.isArray(data))
        data = [data];
    let length = 2;
    data.forEach(function (buf) {
        if (typeof buf === 'string') {
            length += Buffer.byteLength(buf) + 1;
        }
        else {
            length += buf.length + 1;
        }
    });
    return length;
};
const rnull = exports["null"] = {};
rnull.encode = function (data, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(rnull.encodingLength(data));
    if (!offset)
        offset = 0;
    if (typeof data === 'string')
        data = Buffer.from(data);
    if (!data)
        data = Buffer.alloc(0);
    const oldOffset = offset;
    offset += 2;
    const len = data.length;
    data.copy(buf, offset, 0, len);
    offset += len;
    buf.writeUInt16BE(offset - oldOffset - 2, oldOffset);
    rnull.encode.bytes = offset - oldOffset;
    return buf;
};
rnull.encode.bytes = 0;
rnull.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    const len = buf.readUInt16BE(offset);
    offset += 2;
    const data = buf.slice(offset, offset + len);
    offset += len;
    rnull.decode.bytes = offset - oldOffset;
    return data;
};
rnull.decode.bytes = 0;
rnull.encodingLength = function (data) {
    if (!data)
        return 2;
    return (Buffer.isBuffer(data) ? data.length : Buffer.byteLength(data)) + 2;
};
const rhinfo = exports.hinfo = {};
rhinfo.encode = function (data, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(rhinfo.encodingLength(data));
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    offset += 2;
    string.encode(data.cpu, buf, offset);
    offset += string.encode.bytes;
    string.encode(data.os, buf, offset);
    offset += string.encode.bytes;
    buf.writeUInt16BE(offset - oldOffset - 2, oldOffset);
    rhinfo.encode.bytes = offset - oldOffset;
    return buf;
};
rhinfo.encode.bytes = 0;
rhinfo.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    const data = {};
    offset += 2;
    data.cpu = string.decode(buf, offset);
    offset += string.decode.bytes;
    data.os = string.decode(buf, offset);
    offset += string.decode.bytes;
    rhinfo.decode.bytes = offset - oldOffset;
    return data;
};
rhinfo.decode.bytes = 0;
rhinfo.encodingLength = function (data) {
    return string.encodingLength(data.cpu) + string.encodingLength(data.os) + 2;
};
const rptr = exports.ptr = {};
const rcname = exports.cname = rptr;
const rdname = exports.dname = rptr;
rptr.encode = function (data, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(rptr.encodingLength(data));
    if (!offset)
        offset = 0;
    name.encode(data, buf, offset + 2);
    buf.writeUInt16BE(name.encode.bytes, offset);
    rptr.encode.bytes = name.encode.bytes + 2;
    return buf;
};
rptr.encode.bytes = 0;
rptr.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const data = name.decode(buf, offset + 2);
    rptr.decode.bytes = name.decode.bytes + 2;
    return data;
};
rptr.decode.bytes = 0;
rptr.encodingLength = function (data) {
    return name.encodingLength(data) + 2;
};
const rsrv = exports.srv = {};
rsrv.encode = function (data, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(rsrv.encodingLength(data));
    if (!offset)
        offset = 0;
    buf.writeUInt16BE(data.priority || 0, offset + 2);
    buf.writeUInt16BE(data.weight || 0, offset + 4);
    buf.writeUInt16BE(data.port || 0, offset + 6);
    name.encode(data.target, buf, offset + 8);
    const len = name.encode.bytes + 6;
    buf.writeUInt16BE(len, offset);
    rsrv.encode.bytes = len + 2;
    return buf;
};
rsrv.encode.bytes = 0;
rsrv.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const len = buf.readUInt16BE(offset);
    const data = {};
    data.priority = buf.readUInt16BE(offset + 2);
    data.weight = buf.readUInt16BE(offset + 4);
    data.port = buf.readUInt16BE(offset + 6);
    data.target = name.decode(buf, offset + 8);
    rsrv.decode.bytes = len + 2;
    return data;
};
rsrv.decode.bytes = 0;
rsrv.encodingLength = function (data) {
    return 8 + name.encodingLength(data.target);
};
const rcaa = exports.caa = {};
rcaa.ISSUER_CRITICAL = 1 << 7;
rcaa.encode = function (data, buf, offset) {
    const len = rcaa.encodingLength(data);
    if (!buf)
        buf = Buffer.alloc(rcaa.encodingLength(data));
    if (!offset)
        offset = 0;
    if (data.issuerCritical) {
        data.flags = rcaa.ISSUER_CRITICAL;
    }
    buf.writeUInt16BE(len - 2, offset);
    offset += 2;
    buf.writeUInt8(data.flags || 0, offset);
    offset += 1;
    string.encode(data.tag, buf, offset);
    offset += string.encode.bytes;
    buf.write(data.value, offset);
    offset += Buffer.byteLength(data.value);
    rcaa.encode.bytes = len;
    return buf;
};
rcaa.encode.bytes = 0;
rcaa.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const len = buf.readUInt16BE(offset);
    offset += 2;
    const oldOffset = offset;
    const data = {};
    data.flags = buf.readUInt8(offset);
    offset += 1;
    data.tag = string.decode(buf, offset);
    offset += string.decode.bytes;
    data.value = buf.toString('utf-8', offset, oldOffset + len);
    data.issuerCritical = !!(data.flags & rcaa.ISSUER_CRITICAL);
    rcaa.decode.bytes = len + 2;
    return data;
};
rcaa.decode.bytes = 0;
rcaa.encodingLength = function (data) {
    return string.encodingLength(data.tag) + string.encodingLength(data.value) + 2;
};
const rmx = exports.mx = {};
rmx.encode = function (data, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(rmx.encodingLength(data));
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    offset += 2;
    buf.writeUInt16BE(data.preference || 0, offset);
    offset += 2;
    name.encode(data.exchange, buf, offset);
    offset += name.encode.bytes;
    buf.writeUInt16BE(offset - oldOffset - 2, oldOffset);
    rmx.encode.bytes = offset - oldOffset;
    return buf;
};
rmx.encode.bytes = 0;
rmx.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    const data = {};
    offset += 2;
    data.preference = buf.readUInt16BE(offset);
    offset += 2;
    data.exchange = name.decode(buf, offset);
    offset += name.decode.bytes;
    rmx.decode.bytes = offset - oldOffset;
    return data;
};
rmx.encodingLength = function (data) {
    return 4 + name.encodingLength(data.exchange);
};
const ra = exports.a = {};
ra.encode = function (host, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(ra.encodingLength(host));
    if (!offset)
        offset = 0;
    buf.writeUInt16BE(4, offset);
    offset += 2;
    ip.v4.encode(host, buf, offset);
    ra.encode.bytes = 6;
    return buf;
};
ra.encode.bytes = 0;
ra.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    offset += 2;
    const host = ip.v4.decode(buf, offset);
    ra.decode.bytes = 6;
    return host;
};
ra.decode.bytes = 0;
ra.encodingLength = function () {
    return 6;
};
const raaaa = exports.aaaa = {};
raaaa.encode = function (host, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(raaaa.encodingLength(host));
    if (!offset)
        offset = 0;
    buf.writeUInt16BE(16, offset);
    offset += 2;
    ip.v6.encode(host, buf, offset);
    raaaa.encode.bytes = 18;
    return buf;
};
raaaa.encode.bytes = 0;
raaaa.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    offset += 2;
    const host = ip.v6.decode(buf, offset);
    raaaa.decode.bytes = 18;
    return host;
};
raaaa.decode.bytes = 0;
raaaa.encodingLength = function () {
    return 18;
};
const roption = exports.option = {};
roption.encode = function (option, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(roption.encodingLength(option));
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    const code = optioncodes.toCode(option.code);
    buf.writeUInt16BE(code, offset);
    offset += 2;
    if (option.data) {
        buf.writeUInt16BE(option.data.length, offset);
        offset += 2;
        option.data.copy(buf, offset);
        offset += option.data.length;
    }
    else {
        switch (code) {
            // case 3: NSID.  No encode makes sense.
            // case 5,6,7: Not implementable
            case 8: // ECS
                // note: do IP math before calling
                const spl = option.sourcePrefixLength || 0;
                const fam = option.family || ip.familyOf(option.ip);
                const ipBuf = ip.encode(option.ip, Buffer.alloc);
                const ipLen = Math.ceil(spl / 8);
                buf.writeUInt16BE(ipLen + 4, offset);
                offset += 2;
                buf.writeUInt16BE(fam, offset);
                offset += 2;
                buf.writeUInt8(spl, offset++);
                buf.writeUInt8(option.scopePrefixLength || 0, offset++);
                ipBuf.copy(buf, offset, 0, ipLen);
                offset += ipLen;
                break;
            // case 9: EXPIRE (experimental)
            // case 10: COOKIE.  No encode makes sense.
            case 11: // KEEP-ALIVE
                if (option.timeout) {
                    buf.writeUInt16BE(2, offset);
                    offset += 2;
                    buf.writeUInt16BE(option.timeout, offset);
                    offset += 2;
                }
                else {
                    buf.writeUInt16BE(0, offset);
                    offset += 2;
                }
                break;
            case 12: // PADDING
                const len = option.length || 0;
                buf.writeUInt16BE(len, offset);
                offset += 2;
                buf.fill(0, offset, offset + len);
                offset += len;
                break;
            // case 13:  CHAIN.  Experimental.
            case 14: // KEY-TAG
                const tagsLen = option.tags.length * 2;
                buf.writeUInt16BE(tagsLen, offset);
                offset += 2;
                for (const tag of option.tags) {
                    buf.writeUInt16BE(tag, offset);
                    offset += 2;
                }
                break;
            default:
                throw new Error(`Unknown roption code: ${option.code}`);
        }
    }
    roption.encode.bytes = offset - oldOffset;
    return buf;
};
roption.encode.bytes = 0;
roption.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const option = {};
    option.code = buf.readUInt16BE(offset);
    option.type = optioncodes.toString(option.code);
    offset += 2;
    const len = buf.readUInt16BE(offset);
    offset += 2;
    option.data = buf.slice(offset, offset + len);
    switch (option.code) {
        // case 3: NSID.  No decode makes sense.
        case 8: // ECS
            option.family = buf.readUInt16BE(offset);
            offset += 2;
            option.sourcePrefixLength = buf.readUInt8(offset++);
            option.scopePrefixLength = buf.readUInt8(offset++);
            const padded = Buffer.alloc((option.family === 1) ? 4 : 16);
            buf.copy(padded, 0, offset, offset + len - 4);
            option.ip = ip.decode(padded);
            break;
        // case 12: Padding.  No decode makes sense.
        case 11: // KEEP-ALIVE
            if (len > 0) {
                option.timeout = buf.readUInt16BE(offset);
                offset += 2;
            }
            break;
        case 14:
            option.tags = [];
            for (let i = 0; i < len; i += 2) {
                option.tags.push(buf.readUInt16BE(offset));
                offset += 2;
            }
        // don't worry about default.  caller will use data if desired
    }
    roption.decode.bytes = len + 4;
    return option;
};
roption.decode.bytes = 0;
roption.encodingLength = function (option) {
    if (option.data) {
        return option.data.length + 4;
    }
    const code = optioncodes.toCode(option.code);
    switch (code) {
        case 8: // ECS
            const spl = option.sourcePrefixLength || 0;
            return Math.ceil(spl / 8) + 8;
        case 11: // KEEP-ALIVE
            return (typeof option.timeout === 'number') ? 6 : 4;
        case 12: // PADDING
            return option.length + 4;
        case 14: // KEY-TAG
            return 4 + (option.tags.length * 2);
    }
    throw new Error(`Unknown roption code: ${option.code}`);
};
const ropt = exports.opt = {};
ropt.encode = function (options, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(ropt.encodingLength(options));
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    const rdlen = encodingLengthList(options, roption);
    buf.writeUInt16BE(rdlen, offset);
    offset = encodeList(options, roption, buf, offset + 2);
    ropt.encode.bytes = offset - oldOffset;
    return buf;
};
ropt.encode.bytes = 0;
ropt.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    const options = [];
    let rdlen = buf.readUInt16BE(offset);
    offset += 2;
    let o = 0;
    while (rdlen > 0) {
        options[o++] = roption.decode(buf, offset);
        offset += roption.decode.bytes;
        rdlen -= roption.decode.bytes;
    }
    ropt.decode.bytes = offset - oldOffset;
    return options;
};
ropt.decode.bytes = 0;
ropt.encodingLength = function (options) {
    return 2 + encodingLengthList(options || [], roption);
};
const rdnskey = exports.dnskey = {};
rdnskey.PROTOCOL_DNSSEC = 3;
rdnskey.ZONE_KEY = 0x80;
rdnskey.SECURE_ENTRYPOINT = 0x8000;
rdnskey.encode = function (key, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(rdnskey.encodingLength(key));
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    const keydata = key.key;
    if (!Buffer.isBuffer(keydata)) {
        throw new Error('Key must be a Buffer');
    }
    offset += 2; // Leave space for length
    buf.writeUInt16BE(key.flags, offset);
    offset += 2;
    buf.writeUInt8(rdnskey.PROTOCOL_DNSSEC, offset);
    offset += 1;
    buf.writeUInt8(key.algorithm, offset);
    offset += 1;
    keydata.copy(buf, offset, 0, keydata.length);
    offset += keydata.length;
    rdnskey.encode.bytes = offset - oldOffset;
    buf.writeUInt16BE(rdnskey.encode.bytes - 2, oldOffset);
    return buf;
};
rdnskey.encode.bytes = 0;
rdnskey.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    var key = {};
    var length = buf.readUInt16BE(offset);
    offset += 2;
    key.flags = buf.readUInt16BE(offset);
    offset += 2;
    if (buf.readUInt8(offset) !== rdnskey.PROTOCOL_DNSSEC) {
        throw new Error('Protocol must be 3');
    }
    offset += 1;
    key.algorithm = buf.readUInt8(offset);
    offset += 1;
    key.key = buf.slice(offset, oldOffset + length + 2);
    offset += key.key.length;
    rdnskey.decode.bytes = offset - oldOffset;
    return key;
};
rdnskey.decode.bytes = 0;
rdnskey.encodingLength = function (key) {
    return 6 + Buffer.byteLength(key.key);
};
const rrrsig = exports.rrsig = {};
rrrsig.encode = function (sig, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(rrrsig.encodingLength(sig));
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    const signature = sig.signature;
    if (!Buffer.isBuffer(signature)) {
        throw new Error('Signature must be a Buffer');
    }
    offset += 2; // Leave space for length
    buf.writeUInt16BE(types.toType(sig.typeCovered), offset);
    offset += 2;
    buf.writeUInt8(sig.algorithm, offset);
    offset += 1;
    buf.writeUInt8(sig.labels, offset);
    offset += 1;
    buf.writeUInt32BE(sig.originalTTL, offset);
    offset += 4;
    buf.writeUInt32BE(sig.expiration, offset);
    offset += 4;
    buf.writeUInt32BE(sig.inception, offset);
    offset += 4;
    buf.writeUInt16BE(sig.keyTag, offset);
    offset += 2;
    name.encode(sig.signersName, buf, offset);
    offset += name.encode.bytes;
    signature.copy(buf, offset, 0, signature.length);
    offset += signature.length;
    rrrsig.encode.bytes = offset - oldOffset;
    buf.writeUInt16BE(rrrsig.encode.bytes - 2, oldOffset);
    return buf;
};
rrrsig.encode.bytes = 0;
rrrsig.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    var sig = {};
    var length = buf.readUInt16BE(offset);
    offset += 2;
    sig.typeCovered = types.toString(buf.readUInt16BE(offset));
    offset += 2;
    sig.algorithm = buf.readUInt8(offset);
    offset += 1;
    sig.labels = buf.readUInt8(offset);
    offset += 1;
    sig.originalTTL = buf.readUInt32BE(offset);
    offset += 4;
    sig.expiration = buf.readUInt32BE(offset);
    offset += 4;
    sig.inception = buf.readUInt32BE(offset);
    offset += 4;
    sig.keyTag = buf.readUInt16BE(offset);
    offset += 2;
    sig.signersName = name.decode(buf, offset);
    offset += name.decode.bytes;
    sig.signature = buf.slice(offset, oldOffset + length + 2);
    offset += sig.signature.length;
    rrrsig.decode.bytes = offset - oldOffset;
    return sig;
};
rrrsig.decode.bytes = 0;
rrrsig.encodingLength = function (sig) {
    return 20 +
        name.encodingLength(sig.signersName) +
        Buffer.byteLength(sig.signature);
};
const rrp = exports.rp = {};
rrp.encode = function (data, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(rrp.encodingLength(data));
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    offset += 2; // Leave space for length
    name.encode(data.mbox || '.', buf, offset, { mail: true });
    offset += name.encode.bytes;
    name.encode(data.txt || '.', buf, offset);
    offset += name.encode.bytes;
    rrp.encode.bytes = offset - oldOffset;
    buf.writeUInt16BE(rrp.encode.bytes - 2, oldOffset);
    return buf;
};
rrp.encode.bytes = 0;
rrp.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    const data = {};
    offset += 2;
    data.mbox = name.decode(buf, offset, { mail: true }) || '.';
    offset += name.decode.bytes;
    data.txt = name.decode(buf, offset) || '.';
    offset += name.decode.bytes;
    rrp.decode.bytes = offset - oldOffset;
    return data;
};
rrp.decode.bytes = 0;
rrp.encodingLength = function (data) {
    return 2 + name.encodingLength(data.mbox || '.') + name.encodingLength(data.txt || '.');
};
const typebitmap = {};
typebitmap.encode = function (typelist, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(typebitmap.encodingLength(typelist));
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    var typesByWindow = [];
    for (var i = 0; i < typelist.length; i++) {
        var typeid = types.toType(typelist[i]);
        if (typesByWindow[typeid >> 8] === undefined) {
            typesByWindow[typeid >> 8] = [];
        }
        typesByWindow[typeid >> 8][(typeid >> 3) & 0x1F] |= 1 << (7 - (typeid & 0x7));
    }
    for (i = 0; i < typesByWindow.length; i++) {
        if (typesByWindow[i] !== undefined) {
            var windowBuf = Buffer.from(typesByWindow[i]);
            buf.writeUInt8(i, offset);
            offset += 1;
            buf.writeUInt8(windowBuf.length, offset);
            offset += 1;
            windowBuf.copy(buf, offset);
            offset += windowBuf.length;
        }
    }
    typebitmap.encode.bytes = offset - oldOffset;
    return buf;
};
typebitmap.encode.bytes = 0;
typebitmap.decode = function (buf, offset, length) {
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    var typelist = [];
    while (offset - oldOffset < length) {
        var window = buf.readUInt8(offset);
        offset += 1;
        var windowLength = buf.readUInt8(offset);
        offset += 1;
        for (var i = 0; i < windowLength; i++) {
            var b = buf.readUInt8(offset + i);
            for (var j = 0; j < 8; j++) {
                if (b & (1 << (7 - j))) {
                    var typeid = types.toString((window << 8) | (i << 3) | j);
                    typelist.push(typeid);
                }
            }
        }
        offset += windowLength;
    }
    typebitmap.decode.bytes = offset - oldOffset;
    return typelist;
};
typebitmap.decode.bytes = 0;
typebitmap.encodingLength = function (typelist) {
    var extents = [];
    for (var i = 0; i < typelist.length; i++) {
        var typeid = types.toType(typelist[i]);
        extents[typeid >> 8] = Math.max(extents[typeid >> 8] || 0, typeid & 0xFF);
    }
    var len = 0;
    for (i = 0; i < extents.length; i++) {
        if (extents[i] !== undefined) {
            len += 2 + Math.ceil((extents[i] + 1) / 8);
        }
    }
    return len;
};
const rnsec = exports.nsec = {};
rnsec.encode = function (record, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(rnsec.encodingLength(record));
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    offset += 2; // Leave space for length
    name.encode(record.nextDomain, buf, offset);
    offset += name.encode.bytes;
    typebitmap.encode(record.rrtypes, buf, offset);
    offset += typebitmap.encode.bytes;
    rnsec.encode.bytes = offset - oldOffset;
    buf.writeUInt16BE(rnsec.encode.bytes - 2, oldOffset);
    return buf;
};
rnsec.encode.bytes = 0;
rnsec.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    var record = {};
    var length = buf.readUInt16BE(offset);
    offset += 2;
    record.nextDomain = name.decode(buf, offset);
    offset += name.decode.bytes;
    record.rrtypes = typebitmap.decode(buf, offset, length - (offset - oldOffset));
    offset += typebitmap.decode.bytes;
    rnsec.decode.bytes = offset - oldOffset;
    return record;
};
rnsec.decode.bytes = 0;
rnsec.encodingLength = function (record) {
    return 2 +
        name.encodingLength(record.nextDomain) +
        typebitmap.encodingLength(record.rrtypes);
};
const rnsec3 = exports.nsec3 = {};
rnsec3.encode = function (record, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(rnsec3.encodingLength(record));
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    const salt = record.salt;
    if (!Buffer.isBuffer(salt)) {
        throw new Error('salt must be a Buffer');
    }
    const nextDomain = record.nextDomain;
    if (!Buffer.isBuffer(nextDomain)) {
        throw new Error('nextDomain must be a Buffer');
    }
    offset += 2; // Leave space for length
    buf.writeUInt8(record.algorithm, offset);
    offset += 1;
    buf.writeUInt8(record.flags, offset);
    offset += 1;
    buf.writeUInt16BE(record.iterations, offset);
    offset += 2;
    buf.writeUInt8(salt.length, offset);
    offset += 1;
    salt.copy(buf, offset, 0, salt.length);
    offset += salt.length;
    buf.writeUInt8(nextDomain.length, offset);
    offset += 1;
    nextDomain.copy(buf, offset, 0, nextDomain.length);
    offset += nextDomain.length;
    typebitmap.encode(record.rrtypes, buf, offset);
    offset += typebitmap.encode.bytes;
    rnsec3.encode.bytes = offset - oldOffset;
    buf.writeUInt16BE(rnsec3.encode.bytes - 2, oldOffset);
    return buf;
};
rnsec3.encode.bytes = 0;
rnsec3.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    var record = {};
    var length = buf.readUInt16BE(offset);
    offset += 2;
    record.algorithm = buf.readUInt8(offset);
    offset += 1;
    record.flags = buf.readUInt8(offset);
    offset += 1;
    record.iterations = buf.readUInt16BE(offset);
    offset += 2;
    const saltLength = buf.readUInt8(offset);
    offset += 1;
    record.salt = buf.slice(offset, offset + saltLength);
    offset += saltLength;
    const hashLength = buf.readUInt8(offset);
    offset += 1;
    record.nextDomain = buf.slice(offset, offset + hashLength);
    offset += hashLength;
    record.rrtypes = typebitmap.decode(buf, offset, length - (offset - oldOffset));
    offset += typebitmap.decode.bytes;
    rnsec3.decode.bytes = offset - oldOffset;
    return record;
};
rnsec3.decode.bytes = 0;
rnsec3.encodingLength = function (record) {
    return 8 +
        record.salt.length +
        record.nextDomain.length +
        typebitmap.encodingLength(record.rrtypes);
};
const rds = exports.ds = {};
rds.encode = function (digest, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(rds.encodingLength(digest));
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    const digestdata = digest.digest;
    if (!Buffer.isBuffer(digestdata)) {
        throw new Error('Digest must be a Buffer');
    }
    offset += 2; // Leave space for length
    buf.writeUInt16BE(digest.keyTag, offset);
    offset += 2;
    buf.writeUInt8(digest.algorithm, offset);
    offset += 1;
    buf.writeUInt8(digest.digestType, offset);
    offset += 1;
    digestdata.copy(buf, offset, 0, digestdata.length);
    offset += digestdata.length;
    rds.encode.bytes = offset - oldOffset;
    buf.writeUInt16BE(rds.encode.bytes - 2, oldOffset);
    return buf;
};
rds.encode.bytes = 0;
rds.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    var digest = {};
    var length = buf.readUInt16BE(offset);
    offset += 2;
    digest.keyTag = buf.readUInt16BE(offset);
    offset += 2;
    digest.algorithm = buf.readUInt8(offset);
    offset += 1;
    digest.digestType = buf.readUInt8(offset);
    offset += 1;
    digest.digest = buf.slice(offset, oldOffset + length + 2);
    offset += digest.digest.length;
    rds.decode.bytes = offset - oldOffset;
    return digest;
};
rds.decode.bytes = 0;
rds.encodingLength = function (digest) {
    return 6 + Buffer.byteLength(digest.digest);
};
const rsshfp = exports.sshfp = {};
rsshfp.getFingerprintLengthForHashType = function getFingerprintLengthForHashType(hashType) {
    switch (hashType) {
        case 1: return 20;
        case 2: return 32;
    }
};
rsshfp.encode = function encode(record, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(rsshfp.encodingLength(record));
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    offset += 2; // The function call starts with the offset pointer at the RDLENGTH field, not the RDATA one
    buf[offset] = record.algorithm;
    offset += 1;
    buf[offset] = record.hash;
    offset += 1;
    const fingerprintBuf = Buffer.from(record.fingerprint.toUpperCase(), 'hex');
    if (fingerprintBuf.length !== rsshfp.getFingerprintLengthForHashType(record.hash)) {
        throw new Error('Invalid fingerprint length');
    }
    fingerprintBuf.copy(buf, offset);
    offset += fingerprintBuf.byteLength;
    rsshfp.encode.bytes = offset - oldOffset;
    buf.writeUInt16BE(rsshfp.encode.bytes - 2, oldOffset);
    return buf;
};
rsshfp.encode.bytes = 0;
rsshfp.decode = function decode(buf, offset) {
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    const record = {};
    offset += 2; // Account for the RDLENGTH field
    record.algorithm = buf[offset];
    offset += 1;
    record.hash = buf[offset];
    offset += 1;
    const fingerprintLength = rsshfp.getFingerprintLengthForHashType(record.hash);
    record.fingerprint = buf.slice(offset, offset + fingerprintLength).toString('hex').toUpperCase();
    offset += fingerprintLength;
    rsshfp.decode.bytes = offset - oldOffset;
    return record;
};
rsshfp.decode.bytes = 0;
rsshfp.encodingLength = function (record) {
    return 4 + Buffer.from(record.fingerprint, 'hex').byteLength;
};
const rnaptr = exports.naptr = {};
rnaptr.encode = function (data, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(rnaptr.encodingLength(data));
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    offset += 2;
    buf.writeUInt16BE(data.order || 0, offset);
    offset += 2;
    buf.writeUInt16BE(data.preference || 0, offset);
    offset += 2;
    string.encode(data.flags, buf, offset);
    offset += string.encode.bytes;
    string.encode(data.services, buf, offset);
    offset += string.encode.bytes;
    string.encode(data.regexp, buf, offset);
    offset += string.encode.bytes;
    name.encode(data.replacement, buf, offset);
    offset += name.encode.bytes;
    rnaptr.encode.bytes = offset - oldOffset;
    buf.writeUInt16BE(rnaptr.encode.bytes - 2, oldOffset);
    return buf;
};
rnaptr.encode.bytes = 0;
rnaptr.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    const data = {};
    offset += 2;
    data.order = buf.readUInt16BE(offset);
    offset += 2;
    data.preference = buf.readUInt16BE(offset);
    offset += 2;
    data.flags = string.decode(buf, offset);
    offset += string.decode.bytes;
    data.services = string.decode(buf, offset);
    offset += string.decode.bytes;
    data.regexp = string.decode(buf, offset);
    offset += string.decode.bytes;
    data.replacement = name.decode(buf, offset);
    offset += name.decode.bytes;
    rnaptr.decode.bytes = offset - oldOffset;
    return data;
};
rnaptr.decode.bytes = 0;
rnaptr.encodingLength = function (data) {
    return string.encodingLength(data.flags) +
        string.encodingLength(data.services) +
        string.encodingLength(data.regexp) +
        name.encodingLength(data.replacement) + 6;
};
const rtlsa = exports.tlsa = {};
rtlsa.encode = function (cert, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(rtlsa.encodingLength(cert));
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    const certdata = cert.certificate;
    if (!Buffer.isBuffer(certdata)) {
        throw new Error('Certificate must be a Buffer');
    }
    offset += 2; // Leave space for length
    buf.writeUInt8(cert.usage, offset);
    offset += 1;
    buf.writeUInt8(cert.selector, offset);
    offset += 1;
    buf.writeUInt8(cert.matchingType, offset);
    offset += 1;
    certdata.copy(buf, offset, 0, certdata.length);
    offset += certdata.length;
    rtlsa.encode.bytes = offset - oldOffset;
    buf.writeUInt16BE(rtlsa.encode.bytes - 2, oldOffset);
    return buf;
};
rtlsa.encode.bytes = 0;
rtlsa.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    const cert = {};
    const length = buf.readUInt16BE(offset);
    offset += 2;
    cert.usage = buf.readUInt8(offset);
    offset += 1;
    cert.selector = buf.readUInt8(offset);
    offset += 1;
    cert.matchingType = buf.readUInt8(offset);
    offset += 1;
    cert.certificate = buf.slice(offset, oldOffset + length + 2);
    offset += cert.certificate.length;
    rtlsa.decode.bytes = offset - oldOffset;
    return cert;
};
rtlsa.decode.bytes = 0;
rtlsa.encodingLength = function (cert) {
    return 5 + Buffer.byteLength(cert.certificate);
};
const renc = exports.record = function (type) {
    switch (type.toUpperCase()) {
        case 'A': return ra;
        case 'PTR': return rptr;
        case 'CNAME': return rcname;
        case 'DNAME': return rdname;
        case 'TXT': return rtxt;
        case 'NULL': return rnull;
        case 'AAAA': return raaaa;
        case 'SRV': return rsrv;
        case 'HINFO': return rhinfo;
        case 'CAA': return rcaa;
        case 'NS': return rns;
        case 'SOA': return rsoa;
        case 'MX': return rmx;
        case 'OPT': return ropt;
        case 'DNSKEY': return rdnskey;
        case 'RRSIG': return rrrsig;
        case 'RP': return rrp;
        case 'NSEC': return rnsec;
        case 'NSEC3': return rnsec3;
        case 'SSHFP': return rsshfp;
        case 'DS': return rds;
        case 'NAPTR': return rnaptr;
        case 'TLSA': return rtlsa;
    }
    return runknown;
};
const answer = exports.answer = {};
answer.encode = function (a, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(answer.encodingLength(a));
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    name.encode(a.name, buf, offset);
    offset += name.encode.bytes;
    buf.writeUInt16BE(types.toType(a.type), offset);
    if (a.type.toUpperCase() === 'OPT') {
        if (a.name !== '.') {
            throw new Error('OPT name must be root.');
        }
        buf.writeUInt16BE(a.udpPayloadSize || 4096, offset + 2);
        buf.writeUInt8(a.extendedRcode || 0, offset + 4);
        buf.writeUInt8(a.ednsVersion || 0, offset + 5);
        buf.writeUInt16BE(a.flags || 0, offset + 6);
        offset += 8;
        ropt.encode(a.options || [], buf, offset);
        offset += ropt.encode.bytes;
    }
    else {
        let klass = classes.toClass(a.class === undefined ? 'IN' : a.class);
        if (a.flush)
            klass |= FLUSH_MASK; // the 1st bit of the class is the flush bit
        buf.writeUInt16BE(klass, offset + 2);
        buf.writeUInt32BE(a.ttl || 0, offset + 4);
        offset += 8;
        const enc = renc(a.type);
        enc.encode(a.data, buf, offset);
        offset += enc.encode.bytes;
    }
    answer.encode.bytes = offset - oldOffset;
    return buf;
};
answer.encode.bytes = 0;
answer.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const a = {};
    const oldOffset = offset;
    a.name = name.decode(buf, offset);
    offset += name.decode.bytes;
    a.type = types.toString(buf.readUInt16BE(offset));
    if (a.type === 'OPT') {
        a.udpPayloadSize = buf.readUInt16BE(offset + 2);
        a.extendedRcode = buf.readUInt8(offset + 4);
        a.ednsVersion = buf.readUInt8(offset + 5);
        a.flags = buf.readUInt16BE(offset + 6);
        a.flag_do = ((a.flags >> 15) & 0x1) === 1;
        a.options = ropt.decode(buf, offset + 8);
        offset += 8 + ropt.decode.bytes;
    }
    else {
        const klass = buf.readUInt16BE(offset + 2);
        a.ttl = buf.readUInt32BE(offset + 4);
        a.class = classes.toString(klass & NOT_FLUSH_MASK);
        a.flush = !!(klass & FLUSH_MASK);
        const enc = renc(a.type);
        a.data = enc.decode(buf, offset + 8);
        offset += 8 + enc.decode.bytes;
    }
    answer.decode.bytes = offset - oldOffset;
    return a;
};
answer.decode.bytes = 0;
answer.encodingLength = function (a) {
    const data = (a.data !== null && a.data !== undefined) ? a.data : a.options;
    return name.encodingLength(a.name) + 8 + renc(a.type).encodingLength(data);
};
const question = exports.question = {};
question.encode = function (q, buf, offset) {
    if (!buf)
        buf = Buffer.alloc(question.encodingLength(q));
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    name.encode(q.name, buf, offset);
    offset += name.encode.bytes;
    buf.writeUInt16BE(types.toType(q.type), offset);
    offset += 2;
    buf.writeUInt16BE(classes.toClass(q.class === undefined ? 'IN' : q.class), offset);
    offset += 2;
    question.encode.bytes = offset - oldOffset;
    return q;
};
question.encode.bytes = 0;
question.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    const q = {};
    q.name = name.decode(buf, offset);
    offset += name.decode.bytes;
    q.type = types.toString(buf.readUInt16BE(offset));
    offset += 2;
    q.class = classes.toString(buf.readUInt16BE(offset));
    offset += 2;
    const qu = !!(q.class & QU_MASK);
    if (qu)
        q.class &= NOT_QU_MASK;
    question.decode.bytes = offset - oldOffset;
    return q;
};
question.decode.bytes = 0;
question.encodingLength = function (q) {
    return name.encodingLength(q.name) + 4;
};
exports.AUTHORITATIVE_ANSWER = 1 << 10;
exports.TRUNCATED_RESPONSE = 1 << 9;
exports.RECURSION_DESIRED = 1 << 8;
exports.RECURSION_AVAILABLE = 1 << 7;
exports.AUTHENTIC_DATA = 1 << 5;
exports.CHECKING_DISABLED = 1 << 4;
exports.DNSSEC_OK = 1 << 15;
exports.encode = function (result, buf, offset) {
    const allocing = !buf;
    if (allocing)
        buf = Buffer.alloc(exports.encodingLength(result));
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    if (!result.questions)
        result.questions = [];
    if (!result.answers)
        result.answers = [];
    if (!result.authorities)
        result.authorities = [];
    if (!result.additionals)
        result.additionals = [];
    header.encode(result, buf, offset);
    offset += header.encode.bytes;
    offset = encodeList(result.questions, question, buf, offset);
    offset = encodeList(result.answers, answer, buf, offset);
    offset = encodeList(result.authorities, answer, buf, offset);
    offset = encodeList(result.additionals, answer, buf, offset);
    exports.encode.bytes = offset - oldOffset;
    // just a quick sanity check
    if (allocing && exports.encode.bytes !== buf.length) {
        return buf.slice(0, exports.encode.bytes);
    }
    return buf;
};
exports.encode.bytes = 0;
exports.decode = function (buf, offset) {
    if (!offset)
        offset = 0;
    const oldOffset = offset;
    const result = header.decode(buf, offset);
    offset += header.decode.bytes;
    offset = decodeList(result.questions, question, buf, offset);
    offset = decodeList(result.answers, answer, buf, offset);
    offset = decodeList(result.authorities, answer, buf, offset);
    offset = decodeList(result.additionals, answer, buf, offset);
    exports.decode.bytes = offset - oldOffset;
    return result;
};
exports.decode.bytes = 0;
exports.encodingLength = function (result) {
    return header.encodingLength(result) +
        encodingLengthList(result.questions || [], question) +
        encodingLengthList(result.answers || [], answer) +
        encodingLengthList(result.authorities || [], answer) +
        encodingLengthList(result.additionals || [], answer);
};
exports.streamEncode = function (result) {
    const buf = exports.encode(result);
    const sbuf = Buffer.alloc(2);
    sbuf.writeUInt16BE(buf.byteLength);
    const combine = Buffer.concat([sbuf, buf]);
    exports.streamEncode.bytes = combine.byteLength;
    return combine;
};
exports.streamEncode.bytes = 0;
exports.streamDecode = function (sbuf) {
    const len = sbuf.readUInt16BE(0);
    if (sbuf.byteLength < len + 2) {
        // not enough data
        return null;
    }
    const result = exports.decode(sbuf.slice(2));
    exports.streamDecode.bytes = exports.decode.bytes;
    return result;
};
exports.streamDecode.bytes = 0;
function encodingLengthList(list, enc) {
    let len = 0;
    for (let i = 0; i < list.length; i++)
        len += enc.encodingLength(list[i]);
    return len;
}
function encodeList(list, enc, buf, offset) {
    for (let i = 0; i < list.length; i++) {
        enc.encode(list[i], buf, offset);
        offset += enc.encode.bytes;
    }
    return offset;
}
function decodeList(list, enc, buf, offset) {
    for (let i = 0; i < list.length; i++) {
        list[i] = enc.decode(buf, offset);
        offset += enc.decode.bytes;
    }
    return offset;
}


/***/ }),

/***/ 1694:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VolumeChanged = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class VolumeChanged {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsVolumeChanged(bb, obj) {
        return (obj || new VolumeChanged()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsVolumeChanged(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new VolumeChanged()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    volume() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readFloat32(this.bb_pos + offset) : 0.0;
    }
    static startVolumeChanged(builder) {
        builder.startObject(1);
    }
    static addVolume(builder, volume) {
        builder.addFieldFloat32(0, volume, 0.0);
    }
    static endVolumeChanged(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createVolumeChanged(builder, volume) {
        VolumeChanged.startVolumeChanged(builder);
        VolumeChanged.addVolume(builder, volume);
        return VolumeChanged.endVolumeChanged(builder);
    }
}
exports.VolumeChanged = VolumeChanged;


/***/ }),

/***/ 1717:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AudioMetadata = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const chapter_1 = __webpack_require__(528);
class AudioMetadata {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsAudioMetadata(bb, obj) {
        return (obj || new AudioMetadata()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsAudioMetadata(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new AudioMetadata()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    artist(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    album(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    chapters(index, obj) {
        const offset = this.bb.__offset(this.bb_pos, 8);
        return offset ? (obj || new chapter_1.Chapter()).__init(this.bb.__indirect(this.bb.__vector(this.bb_pos + offset) + index * 4), this.bb) : null;
    }
    chaptersLength() {
        const offset = this.bb.__offset(this.bb_pos, 8);
        return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
    }
    static startAudioMetadata(builder) {
        builder.startObject(3);
    }
    static addArtist(builder, artistOffset) {
        builder.addFieldOffset(0, artistOffset, 0);
    }
    static addAlbum(builder, albumOffset) {
        builder.addFieldOffset(1, albumOffset, 0);
    }
    static addChapters(builder, chaptersOffset) {
        builder.addFieldOffset(2, chaptersOffset, 0);
    }
    static createChaptersVector(builder, data) {
        builder.startVector(4, data.length, 4);
        for (let i = data.length - 1; i >= 0; i--) {
            builder.addOffset(data[i]);
        }
        return builder.endVector();
    }
    static startChaptersVector(builder, numElems) {
        builder.startVector(4, numElems, 4);
    }
    static endAudioMetadata(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createAudioMetadata(builder, artistOffset, albumOffset, chaptersOffset) {
        AudioMetadata.startAudioMetadata(builder);
        AudioMetadata.addArtist(builder, artistOffset);
        AudioMetadata.addAlbum(builder, albumOffset);
        AudioMetadata.addChapters(builder, chaptersOffset);
        return AudioMetadata.endAudioMetadata(builder);
    }
}
exports.AudioMetadata = AudioMetadata;


/***/ }),

/***/ 1759:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Main = void 0;
exports.getComputerName = getComputerName;
exports.getAppName = getAppName;
exports.getAppVersion = getAppVersion;
exports.getPlayMessage = getPlayMessage;
exports.getPlaybackUpdateMessage = getPlaybackUpdateMessage;
exports.getPlayerVolume = getPlayerVolume;
exports.getV4JoinMessages = getV4JoinMessages;
exports.errorHandler = errorHandler;
// BrewCast network service: TizenBrew runs this bundle (package.json `serviceFile`) in its Node
// service. Ported from upstream's webOS service (receivers/webos/fcast-receiver-service at
// 5c79300), with the Luna bus replaced by a local HTTP/SSE channel (Ipc.ts) and protocol v4 added.
const fs = __importStar(__webpack_require__(9896));
const os = __importStar(__webpack_require__(857));
const events_1 = __webpack_require__(4434);
const Packets_1 = __webpack_require__(834);
const DiscoveryService_1 = __webpack_require__(3806);
const TcpListenerService_1 = __webpack_require__(5693);
const ConnectionMonitor_1 = __webpack_require__(1817);
const Logger_1 = __webpack_require__(1943);
const Toast_1 = __webpack_require__(2555);
const Certificate_1 = __webpack_require__(4721);
const Codec_1 = __webpack_require__(3196);
const Ipc_1 = __webpack_require__(926);
const Platform_1 = __webpack_require__(8169);
const Companion_1 = __webpack_require__(5230);
const MediaSession_1 = __webpack_require__(7666);
const Subtitles_1 = __webpack_require__(649);
const logger = new Logger_1.Logger('Main', Logger_1.LoggerType.BACKEND);
const APP_NAME = 'BrewCast';
const CAPABILITIES_FILE = 'brewcast-capabilities.json';
// What the TV's player handles, as v4 format tokens (fcast.fbs). Senders use this to decide what
// to send or transcode. These are conservative defaults: the player page probes the TV and
// reports what it actually supports (`report_capabilities`), which is kept for later sessions.
const DEFAULT_MEDIA_CAPABILITIES = {
    protocols: ['http', 'https', 'data'],
    containers: ['mp4', 'quicktime', 'webm', 'mkv', 'mpegts', 'hls', 'dash'],
    videoFormats: ['h264', 'h265', 'vp8', 'vp9'],
    audioFormats: ['aac', 'mp3', 'ac3', 'eac3', 'opus', 'vorbis', 'flac', 'pcm'],
    // External subtitles are converted to WebVTT by the service (Subtitles.ts).
    subtitleFormats: ['vtt', 'srt', 'ass', 'ssa'],
    hdrFormats: [],
    imageFormats: ['png', 'jpeg', 'gif', 'webp', 'bmp'],
    externalSubtitles: true,
    // Needs WebRTC in the TV's browser, which only the pages can tell.
    mirroring: false,
};
class AppCache {
    constructor() {
        this.deviceName = null;
        this.fingerprint = null;
        this.protocolVersion = Packets_1.PROTOCOL_VERSION;
    }
}
class Main {
    static bridgeBase() {
        return `http://127.0.0.1:${Main.ipc.port || Ipc_1.IPC_PORT}`;
    }
    static subscribedKeys() {
        const keys = Main.tcpListenerService.getAllSubscribedKeys();
        // JSON can't carry sets.
        return { keyDown: Array.from(keys.keyDown), keyUp: Array.from(keys.keyUp) };
    }
    // What the main page shows and encodes in its QR code (fcast://r/ connection URL).
    static deviceInfo() {
        return {
            name: Main.cache.deviceName,
            interfaces: getAllIPv4Interfaces(),
            txt: Main.discoveryTxt(),
        };
    }
    static applyPageCapabilities(capabilities) {
        const target = Main.mediaCapabilities;
        const list = (value, fallback) => Array.isArray(value) && value.every((v) => typeof v === 'string') ? value : fallback;
        target.containers = list(capabilities.containers, DEFAULT_MEDIA_CAPABILITIES.containers);
        target.videoFormats = list(capabilities.videoFormats, DEFAULT_MEDIA_CAPABILITIES.videoFormats);
        target.audioFormats = list(capabilities.audioFormats, DEFAULT_MEDIA_CAPABILITIES.audioFormats);
        target.imageFormats = list(capabilities.imageFormats, DEFAULT_MEDIA_CAPABILITIES.imageFormats);
        target.mirroring = capabilities.webrtc === true;
        target.protocols = DEFAULT_MEDIA_CAPABILITIES.protocols.concat(target.mirroring ? ['whep'] : []);
    }
    static loadPageCapabilities() {
        const file = (0, Platform_1.dataPath)(CAPABILITIES_FILE);
        if (file === null || !fs.existsSync(file)) {
            return;
        }
        try {
            Main.applyPageCapabilities(JSON.parse(fs.readFileSync(file, 'utf8')));
        }
        catch (e) {
            logger.warn('Could not read the saved capabilities', e);
        }
    }
    static savePageCapabilities(capabilities) {
        Main.applyPageCapabilities(capabilities);
        logger.info(`Capabilities reported by the page: ${JSON.stringify(Main.mediaCapabilities)}`);
        const file = (0, Platform_1.dataPath)(CAPABILITIES_FILE);
        if (file !== null) {
            try {
                fs.writeFileSync(file, JSON.stringify(capabilities));
            }
            catch (e) {
                logger.warn('Could not save the capabilities', e);
            }
        }
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON from the pages
    static handleCall(method, value) {
        switch (method) {
            case 'send_playback_error':
                Main.media.onPlaybackError(`${value.message}`, value.kind).catch((e) => logger.error('Error report failed', e));
                return null;
            case 'send_playback_update':
                Main.media.onPlaybackUpdate(value);
                return null;
            case 'send_playback_state':
                if (value.state === 'buffering' || value.state === 'ended') {
                    Main.media.onPlaybackState(value.state);
                }
                return null;
            case 'send_volume_update':
                Main.media.onVolumeUpdate(value);
                return null;
            case 'send_tracks':
                Main.media.onTracks(value.loadId, value.report);
                return null;
            case 'subtitle_failed':
                Main.media.onSubtitleFailed(value.id);
                return null;
            case 'send_event':
                Main.tcpListenerService.send(Packets_1.Opcode.Event, value);
                return null;
            case 'play_request':
                Main.media.playRequest(value.loadId, value.playlistIndex).catch((e) => logger.error('Play request failed', e));
                return null;
            case 'mirroring_answer':
                Main.media.mirroringAnswer(value.loadId, `${value.sdp}`);
                return null;
            case 'report_capabilities':
                Main.savePageCapabilities(value);
                return null;
            case 'get_sessions':
                return Main.tcpListenerService.getSenders();
            case 'get_subscribed_keys':
                return Main.subscribedKeys();
            case 'get_device_info':
                return Main.deviceInfo();
            case 'playback_stopped':
                // The user left the player on the TV.
                Main.media.stop(null);
                return null;
            case 'network_changed':
                logger.info('Network interfaces have changed');
                Main.restartDiscovery();
                Main.ipc.broadcast('device_info', Main.deviceInfo());
                return null;
            default:
                throw new Error(`unknown method ${method}`);
        }
    }
    static discoveryTxt() {
        const txt = { v: `${Main.cache.protocolVersion}` };
        if (Main.cache.fingerprint !== null) {
            txt.fp = Main.cache.fingerprint;
        }
        return txt;
    }
    static restartDiscovery() {
        Main.discoveryService.stop();
        Main.discoveryService = new DiscoveryService_1.DiscoveryService();
        Main.discoveryService.start(Main.discoveryTxt(), Main.tcpListenerService.port);
    }
    static setupV4() {
        const reason = (0, Certificate_1.v4UnsupportedReason)();
        if (reason !== null) {
            logger.warn(`Protocol v4 disabled (${reason}); offering v${Packets_1.PROTOCOL_VERSION}`);
            return null;
        }
        try {
            const identity = (0, Certificate_1.loadOrCreateV4Identity)((0, Platform_1.dataPath)('brewcast-v4-key.pem'));
            Main.cache.fingerprint = identity.fingerprint;
            Main.cache.protocolVersion = Packets_1.V4_PROTOCOL_VERSION;
            logger.info(`Protocol v4 enabled, fingerprint ${identity.fingerprint}`);
            return { identity: identity, mediaCapabilities: Main.mediaCapabilities, volumeStepInterval: 0.01 };
        }
        catch (e) {
            logger.error(`Protocol v4 disabled: could not set up TLS; offering v${Packets_1.PROTOCOL_VERSION}`, e);
            return null;
        }
    }
    static wireListener(listener) {
        const on = (event, handler) => {
            listener.emitter.on(event, (...args) => {
                try {
                    handler(...args);
                }
                catch (e) {
                    logger.error(`Handling '${event}' failed`, e);
                }
            });
        };
        Main.media.bind(listener.emitter, () => Main.mediaCapabilities.mirroring);
        on('connect', (message) => {
            ConnectionMonitor_1.ConnectionMonitor.onConnect(listener, message, () => Main.emitter.emit('connect', message));
        });
        on('disconnect', (message) => {
            ConnectionMonitor_1.ConnectionMonitor.onDisconnect(message, () => Main.emitter.emit('disconnect', message));
        });
        on('ping', (sessionId) => ConnectionMonitor_1.ConnectionMonitor.onPingPong(sessionId));
        on('pong', (sessionId) => ConnectionMonitor_1.ConnectionMonitor.onPingPong(sessionId));
        on('initial', (message) => logger.info(`Sender introduced itself: ${JSON.stringify(message)}`));
        const onSubscriptionChange = (subscribe) => (message) => {
            if (subscribe) {
                listener.subscribeEvent(message.sessionId, message.body.event);
            }
            else {
                listener.unsubscribeEvent(message.sessionId, message.body.event);
            }
            if (message.body.event.type === Packets_1.EventType.KeyDown.valueOf() || message.body.event.type === Packets_1.EventType.KeyUp.valueOf()) {
                Main.emitter.emit('event_subscribed_keys_update', Main.subscribedKeys());
            }
        };
        on('subscribeevent', onSubscriptionChange(true));
        on('unsubscribeevent', onSubscriptionChange(false));
    }
    static async start() {
        logger.info(`${APP_NAME} ${"0.1.0"} service starting, Node ${process.version} on ${process.platform} ${process.arch}`);
        Main.emitter = new events_1.EventEmitter();
        Main.ipc = new Ipc_1.IpcServer((method, value) => Main.handleCall(method, value));
        Main.companion = new Companion_1.Companion((sessionId) => { var _a; return (_a = Main.tcpListenerService) === null || _a === void 0 ? void 0 : _a.getSession(sessionId); }, () => Main.bridgeBase());
        Main.media = new MediaSession_1.MediaSession({
            listener: () => Main.tcpListenerService,
            companion: Main.companion,
            page: (event, value) => Main.ipc.broadcast(event, value),
            ensurePage: () => {
                if (!Main.ipc.hasClients()) {
                    (0, Platform_1.launchModule)('launch=play');
                }
            },
            subtitleUrl: (source) => (0, Subtitles_1.subtitleRouteUrl)(Main.bridgeBase(), source),
        });
        Main.pageEvents.forEach((event) => Main.emitter.on(event, (value) => Main.ipc.broadcast(event, value)));
        Main.ipc.routes.push(Main.companion.route, Subtitles_1.subtitleRoute);
        Main.ipc.onClientConnected = (send) => {
            // A page that just (re)loaded catches up on anything it missed while navigating.
            send('device_info', Main.deviceInfo());
            Main.media.replay(send);
        };
        Main.ipc.start(envPort('BREWCAST_IPC_PORT', Ipc_1.IPC_PORT));
        Main.loadPageCapabilities();
        Main.cache.deviceName = await (0, Platform_1.fetchDeviceName)();
        const v4Config = Main.setupV4();
        Main.connectionMonitor = new ConnectionMonitor_1.ConnectionMonitor();
        const listener = new TcpListenerService_1.TcpListenerService(v4Config);
        Main.tcpListenerService = listener;
        Main.wireListener(listener);
        listener.start(envPort('BREWCAST_PORT', TcpListenerService_1.TcpListenerService.PORT));
        Main.discoveryService = new DiscoveryService_1.DiscoveryService();
        Main.discoveryService.start(Main.discoveryTxt(), listener.port || TcpListenerService_1.TcpListenerService.PORT);
        logger.info(`Listening on port ${listener.port || TcpListenerService_1.TcpListenerService.PORT} as "${Main.cache.deviceName}", protocol v${Main.cache.protocolVersion}`);
    }
}
exports.Main = Main;
Main.cache = new AppCache();
// Shared with every session (by reference), so capability reports apply to new senders.
Main.mediaCapabilities = { ...DEFAULT_MEDIA_CAPABILITIES };
// Events forwarded to the pages as-is.
Main.pageEvents = [
    'toast',
    'connect',
    'disconnect',
    'event_subscribed_keys_update',
];
// Ports can be moved for local test runs; senders and the pages expect the defaults.
function envPort(name, fallback) {
    const value = Number(process.env[name]);
    return Number.isInteger(value) && value > 0 && value < 65536 ? value : fallback;
}
function getComputerName() {
    return Main.cache.deviceName;
}
function getAppName() {
    return APP_NAME;
}
function getAppVersion() {
    return "0.1.0";
}
function getPlayMessage() {
    return Main.media ? Main.media.currentPlayMessage() : null;
}
function getPlaybackUpdateMessage() {
    return Main.media ? Main.media.playbackUpdate : null;
}
function getPlayerVolume() {
    return Main.media ? Main.media.volume : null;
}
// What a v4 sender that connects mid-playback is told: the loaded media, then its tracks.
function getV4JoinMessages() {
    if (!Main.media) {
        return [];
    }
    const source = Main.media.v4LoadSource();
    return (source ? [(0, Codec_1.encodeLoadSource)(source)] : []).concat(Main.media.v4TrackMessages());
}
async function errorHandler(error) {
    var _a;
    logger.error('Service error:', error);
    (_a = Main.emitter) === null || _a === void 0 ? void 0 : _a.emit('toast', { message: `${error}`, icon: Toast_1.ToastIcon.ERROR });
}
// In the shape the main page renders. Signal strength isn't available to the service.
function getAllIPv4Interfaces() {
    const interfaces = os.networkInterfaces();
    const result = [];
    for (const interfaceName in interfaces) {
        const addresses = interfaces[interfaceName];
        if (!addresses)
            continue;
        for (const addressInfo of addresses) {
            if ((addressInfo.family === 'IPv4' || addressInfo.family === 4) && !addressInfo.internal) {
                const wireless = /^(wl|wifi|ra)/i.test(interfaceName);
                result.push({ name: wireless ? 'Wi-Fi' : 'Wired', address: addressInfo.address, type: wireless ? 'wireless' : 'wired' });
            }
        }
    }
    return result;
}


/***/ }),

/***/ 1800:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.QueueItem = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const media_item_1 = __webpack_require__(2561);
const time_1 = __webpack_require__(6004);
class QueueItem {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsQueueItem(bb, obj) {
        return (obj || new QueueItem()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsQueueItem(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new QueueItem()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    mediaItem(obj) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? (obj || new media_item_1.MediaItem()).__init(this.bb.__indirect(this.bb_pos + offset), this.bb) : null;
    }
    playbackDuration(obj) {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? (obj || new time_1.Time()).__init(this.bb_pos + offset, this.bb) : null;
    }
    static startQueueItem(builder) {
        builder.startObject(2);
    }
    static addMediaItem(builder, mediaItemOffset) {
        builder.addFieldOffset(0, mediaItemOffset, 0);
    }
    static addPlaybackDuration(builder, playbackDurationOffset) {
        builder.addFieldStruct(1, playbackDurationOffset, 0);
    }
    static endQueueItem(builder) {
        const offset = builder.endObject();
        builder.requiredField(offset, 4); // media_item
        return offset;
    }
}
exports.QueueItem = QueueItem;


/***/ }),

/***/ 1817:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ConnectionMonitor = void 0;
exports.setUiUpdateCallbacks = setUiUpdateCallbacks;
const Packets_1 = __webpack_require__(834);
const Logger_1 = __webpack_require__(1943);
// Window might be re-created while devices are still connected
function setUiUpdateCallbacks(callbacks) {
    const logger = window.targetAPI.logger;
    let frontendConnections = [];
    window.targetAPI.onConnect((_event, value) => {
        logger.debug(`Processing connect event for ${value.data.address} with current connections:`, frontendConnections);
        frontendConnections.push(value.data.address);
        callbacks.onConnect(frontendConnections);
    });
    window.targetAPI.onDisconnect((_event, value) => {
        logger.debug(`Processing disconnect event for ${value.data.address} with current connections:`, frontendConnections);
        const index = frontendConnections.indexOf(value.data.address);
        if (index != -1) {
            frontendConnections.splice(index, 1);
            callbacks.onDisconnect(frontendConnections);
        }
    });
    window.targetAPI.getSessions().then((sessions) => {
        logger.info('Window created with current sessions:', sessions);
        frontendConnections = sessions;
        if (frontendConnections.length > 0) {
            callbacks.onConnect(frontendConnections, true);
        }
    });
}
class ConnectionMonitor {
    constructor() {
        ConnectionMonitor.logger = new Logger_1.Logger('ConnectionMonitor', Logger_1.LoggerType.BACKEND);
        setInterval(() => {
            if (ConnectionMonitor.backendConnections.size > 0) {
                const now = Date.now();
                for (const sessionId of ConnectionMonitor.backendConnections.keys()) {
                    const listener = ConnectionMonitor.backendConnections.get(sessionId);
                    const version = listener.getSessionProtocolVersion(sessionId);
                    if (version >= 4) {
                        const lastPacketAt = listener.getSession(sessionId).lastPacketAt;
                        if (now - lastPacketAt >= ConnectionMonitor.v4DeadAfterMs) {
                            ConnectionMonitor.logger.warn(`No packet from session ${sessionId} for ${now - lastPacketAt}ms. Disconnecting...`);
                            listener.disconnect(sessionId);
                        }
                        else if (now - lastPacketAt >= ConnectionMonitor.v4PingAfterMs &&
                            ConnectionMonitor.v4PingedForPacketAt.get(sessionId) !== lastPacketAt) {
                            ConnectionMonitor.v4PingedForPacketAt.set(sessionId, lastPacketAt);
                            listener.send(Packets_1.Opcode.Ping, null, sessionId);
                        }
                        continue;
                    }
                    if (version >= 2) {
                        if (now - (ConnectionMonitor.lastLegacyPingAt.get(sessionId) || 0) < ConnectionMonitor.connectionPingTimeout) {
                            continue;
                        }
                        ConnectionMonitor.lastLegacyPingAt.set(sessionId, now);
                        if (ConnectionMonitor.heartbeatRetries.get(sessionId) > 3) {
                            ConnectionMonitor.logger.warn(`Could not ping device with connection id ${sessionId}. Disconnecting...`);
                            listener.disconnect(sessionId);
                            continue;
                        }
                        ConnectionMonitor.logger.debug(`Pinging session ${sessionId} with ${ConnectionMonitor.heartbeatRetries.get(sessionId)} retries left`);
                        listener.send(Packets_1.Opcode.Ping, null, sessionId);
                        ConnectionMonitor.heartbeatRetries.set(sessionId, ConnectionMonitor.heartbeatRetries.get(sessionId) + 1);
                    }
                    else if (version === undefined) {
                        ConnectionMonitor.logger.warn(`Session ${sessionId} was not found in the list of active sessions. Removing...`);
                        ConnectionMonitor.backendConnections.delete(sessionId);
                        ConnectionMonitor.heartbeatRetries.delete(sessionId);
                        ConnectionMonitor.lastLegacyPingAt.delete(sessionId);
                        ConnectionMonitor.v4PingedForPacketAt.delete(sessionId);
                    }
                }
            }
        }, ConnectionMonitor.tickMs);
    }
    static onPingPong(sessionId) {
        ConnectionMonitor.logger.debug(`Received response from ${sessionId}`);
        ConnectionMonitor.heartbeatRetries.set(sessionId, 0);
    }
    static onConnect(listener, value, uiUpdateCallback) {
        var _a;
        ConnectionMonitor.logger.info(`Device connected: ${JSON.stringify(value)}`);
        ConnectionMonitor.backendConnections.set(value.sessionId, listener);
        ConnectionMonitor.heartbeatRetries.set(value.sessionId, 0);
        // Occasionally senders seem to instantaneously disconnect and reconnect, so suppress those ui updates
        const senderUpdateQueue = (_a = ConnectionMonitor.uiUpdateMap.get(value.data.address)) !== null && _a !== void 0 ? _a : [];
        senderUpdateQueue.push({ event: 'connect', uiUpdateCallback: uiUpdateCallback });
        ConnectionMonitor.uiUpdateMap.set(value.data.address, senderUpdateQueue);
        if (senderUpdateQueue.length === 1) {
            setTimeout(() => { ConnectionMonitor.processUiUpdateCallbacks(value.data.address); }, ConnectionMonitor.uiConnectUpdateTimeout);
        }
    }
    static onDisconnect(value, uiUpdateCallback) {
        ConnectionMonitor.logger.info(`Device disconnected: ${JSON.stringify(value)}`);
        ConnectionMonitor.backendConnections.delete(value.sessionId);
        ConnectionMonitor.heartbeatRetries.delete(value.sessionId);
        ConnectionMonitor.lastLegacyPingAt.delete(value.sessionId);
        ConnectionMonitor.v4PingedForPacketAt.delete(value.sessionId);
        const senderUpdateQueue = ConnectionMonitor.uiUpdateMap.get(value.data.address);
        senderUpdateQueue.push({ event: 'disconnect', uiUpdateCallback: uiUpdateCallback });
        ConnectionMonitor.uiUpdateMap.set(value.data.address, senderUpdateQueue);
        if (senderUpdateQueue.length === 1) {
            setTimeout(() => { ConnectionMonitor.processUiUpdateCallbacks(value.data.address); }, ConnectionMonitor.uiDisconnectUpdateTimeout);
        }
    }
    static processUiUpdateCallbacks(mapId) {
        const updateQueue = ConnectionMonitor.uiUpdateMap.get(mapId);
        let lastConnectCb;
        let lastDisconnectCb;
        let messageCount = 0;
        updateQueue.forEach(update => {
            ConnectionMonitor.logger.debug(`Processing update event '${update.event}' for ${mapId}`);
            if (update.event === 'connect') {
                messageCount += 1;
                lastConnectCb = update.uiUpdateCallback;
            }
            else if (update.event === 'disconnect') {
                messageCount -= 1;
                lastDisconnectCb = update.uiUpdateCallback;
            }
            else {
                ConnectionMonitor.logger.warn('Unrecognized UI update event:', update.event);
            }
        });
        if (messageCount > 0) {
            ConnectionMonitor.logger.debug(`Sending connect event for ${mapId}`);
            lastConnectCb();
        }
        else if (messageCount < 0) {
            ConnectionMonitor.logger.debug(`Sending disconnect event for ${mapId}`);
            lastDisconnectCb();
        }
        ConnectionMonitor.uiUpdateMap.set(mapId, []);
    }
}
exports.ConnectionMonitor = ConnectionMonitor;
ConnectionMonitor.connectionPingTimeout = 2500;
ConnectionMonitor.heartbeatRetries = new Map();
ConnectionMonitor.backendConnections = new Map(); // is `ListenerService`, but cant import backend module in frontend
ConnectionMonitor.uiConnectUpdateTimeout = 100;
ConnectionMonitor.uiDisconnectUpdateTimeout = 2000; // Senders may reconnect, but generally need more time
ConnectionMonitor.uiUpdateMap = new Map(); // { event: string, uiUpdateCallback: () => void }
// Protocol v4 heartbeat (spec, "Heartbeat"): ping after 3s without any packet from the sender,
// end the session after 6s. v2/v3 keep upstream's policy: a ping every 2.5s, disconnect after
// four unanswered ones.
ConnectionMonitor.v4PingAfterMs = 3000;
ConnectionMonitor.v4DeadAfterMs = 6000;
ConnectionMonitor.tickMs = 500;
ConnectionMonitor.lastLegacyPingAt = new Map();
ConnectionMonitor.v4PingedForPacketAt = new Map();


/***/ }),

/***/ 1907:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Error = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const error_kind_1 = __webpack_require__(5402);
class Error {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsError(bb, obj) {
        return (obj || new Error()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsError(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new Error()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    kind() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readUint8(this.bb_pos + offset) : error_kind_1.ErrorKind.InvalidOpcode;
    }
    packetNum() {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.readUint32(this.bb_pos + offset) : null;
    }
    static startError(builder) {
        builder.startObject(2);
    }
    static addKind(builder, kind) {
        builder.addFieldInt8(0, kind, error_kind_1.ErrorKind.InvalidOpcode);
    }
    static addPacketNum(builder, packetNum) {
        builder.addFieldInt32(1, packetNum, null);
    }
    static endError(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createError(builder, kind, packetNum) {
        Error.startError(builder);
        Error.addKind(builder, kind);
        if (packetNum !== null)
            Error.addPacketNum(builder, packetNum);
        return Error.endError(builder);
    }
}
exports.Error = Error;


/***/ }),

/***/ 1934:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Dir = void 0;
const util_1 = __webpack_require__(4784);
const Dirent_1 = __webpack_require__(1093);
/**
 * A directory stream, like `fs.Dir`.
 */
class Dir {
    constructor(link, options) {
        this.link = link;
        this.options = options;
        this.iteratorInfo = [];
        this.path = link.getParentPath();
        this.iteratorInfo.push(link.children[Symbol.iterator]());
    }
    wrapAsync(method, args, callback) {
        (0, util_1.validateCallback)(callback);
        Promise.resolve().then(() => {
            let result;
            try {
                result = method.apply(this, args);
            }
            catch (err) {
                callback(err);
                return;
            }
            callback(null, result);
        });
    }
    isFunction(x) {
        return typeof x === 'function';
    }
    promisify(obj, fn) {
        return (...args) => new Promise((resolve, reject) => {
            if (this.isFunction(obj[fn])) {
                obj[fn].bind(obj)(...args, (error, result) => {
                    if (error)
                        reject(error);
                    resolve(result);
                });
            }
            else {
                reject('Not a function');
            }
        });
    }
    closeBase() { }
    readBase(iteratorInfo) {
        let done;
        let value;
        let name;
        let link;
        do {
            do {
                ({ done, value } = iteratorInfo[iteratorInfo.length - 1].next());
                if (!done) {
                    [name, link] = value;
                }
                else {
                    break;
                }
            } while (name === '.' || name === '..');
            if (done) {
                iteratorInfo.pop();
                if (iteratorInfo.length === 0) {
                    break;
                }
                else {
                    done = false;
                }
            }
            else {
                if (this.options.recursive && link.children.size) {
                    iteratorInfo.push(link.children[Symbol.iterator]());
                }
                return Dirent_1.default.build(link, this.options.encoding);
            }
        } while (!done);
        return null;
    }
    closeBaseAsync(callback) {
        this.wrapAsync(this.closeBase, [], callback);
    }
    close(callback) {
        if (typeof callback === 'function') {
            this.closeBaseAsync(callback);
        }
        else {
            return this.promisify(this, 'closeBaseAsync')();
        }
    }
    closeSync() {
        this.closeBase();
    }
    readBaseAsync(callback) {
        this.wrapAsync(this.readBase, [this.iteratorInfo], callback);
    }
    read(callback) {
        if (typeof callback === 'function') {
            this.readBaseAsync(callback);
        }
        else {
            return this.promisify(this, 'readBaseAsync')();
        }
    }
    readSync() {
        return this.readBase(this.iteratorInfo);
    }
    [Symbol.asyncIterator]() {
        const iteratorInfo = [];
        const _this = this;
        iteratorInfo.push(_this.link.children[Symbol.iterator]());
        // auxiliary object so promisify() can be used
        const o = {
            readBaseAsync(callback) {
                _this.wrapAsync(_this.readBase, [iteratorInfo], callback);
            },
        };
        return {
            async next() {
                const dirEnt = await _this.promisify(o, 'readBaseAsync')();
                if (dirEnt !== null) {
                    return { done: false, value: dirEnt };
                }
                else {
                    return { done: true, value: undefined };
                }
            },
            [Symbol.asyncIterator]() {
                throw new Error('Not implemented');
            },
        };
    }
}
exports.Dir = Dir;


/***/ }),

/***/ 1943:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Logger = exports.LoggerType = void 0;
var LoggerType;
(function (LoggerType) {
    LoggerType[LoggerType["BACKEND"] = 0] = "BACKEND";
    LoggerType[LoggerType["FRONTEND"] = 1] = "FRONTEND";
})(LoggerType || (exports.LoggerType = LoggerType = {}));
class Logger {
    static initialize(config) {
        // @ts-ignore
        if (false) {}
        Logger.initialized = true;
    }
    constructor(tag = 'default', type = LoggerType.FRONTEND) {
        this.funcTable = {
            trace: console.trace,
            debug: console.debug,
            info: console.log,
            warn: console.warn,
            error: console.error,
            fatal: console.error,
        };
        // @ts-ignore
        if (false) {}
        else if (true) {
            this.funcTable = {
                trace: (message, ...optionalParams) => console.trace(message, ...optionalParams),
                debug: (message, ...optionalParams) => console.log(message, ...optionalParams),
                info: (message, ...optionalParams) => console.log(message, ...optionalParams),
                warn: (message, ...optionalParams) => console.warn(message, ...optionalParams),
                error: (message, ...optionalParams) => console.error(message, ...optionalParams),
                fatal: (message, ...optionalParams) => console.error(message, ...optionalParams),
            };
        }
        else {}
    }
    trace(message, ...optionalParams) {
        this.funcTable.trace(message, ...optionalParams);
    }
    debug(message, ...optionalParams) {
        this.funcTable.debug(message, ...optionalParams);
    }
    info(message, ...optionalParams) {
        this.funcTable.info(message, ...optionalParams);
    }
    warn(message, ...optionalParams) {
        this.funcTable.warn(message, ...optionalParams);
    }
    error(message, ...optionalParams) {
        this.funcTable.error(message, ...optionalParams);
    }
    fatal(message, ...optionalParams) {
        this.funcTable.fatal(message, ...optionalParams);
    }
    shutdown() {
        // @ts-ignore
        if (false) {}
    }
}
exports.Logger = Logger;
Logger.initialized = false;
Logger.log4js = null;
Logger.ipcLoggerTags = {
    trace: [],
    debug: [],
    info: [],
    warn: [],
    error: [],
    fatal: [],
};


/***/ }),

/***/ 1973:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MediaTrackMetadata = void 0;
exports.unionToMediaTrackMetadata = unionToMediaTrackMetadata;
exports.unionListToMediaTrackMetadata = unionListToMediaTrackMetadata;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const audio_track_meta_1 = __webpack_require__(1179);
const subtitle_track_meta_1 = __webpack_require__(6469);
const video_track_meta_1 = __webpack_require__(9084);
var MediaTrackMetadata;
(function (MediaTrackMetadata) {
    MediaTrackMetadata[MediaTrackMetadata["NONE"] = 0] = "NONE";
    MediaTrackMetadata[MediaTrackMetadata["Video"] = 1] = "Video";
    MediaTrackMetadata[MediaTrackMetadata["Audio"] = 2] = "Audio";
    MediaTrackMetadata[MediaTrackMetadata["Subtitle"] = 3] = "Subtitle";
})(MediaTrackMetadata || (exports.MediaTrackMetadata = MediaTrackMetadata = {}));
function unionToMediaTrackMetadata(type, accessor) {
    switch (MediaTrackMetadata[type]) {
        case 'NONE': return null;
        case 'Video': return accessor(new video_track_meta_1.VideoTrackMeta());
        case 'Audio': return accessor(new audio_track_meta_1.AudioTrackMeta());
        case 'Subtitle': return accessor(new subtitle_track_meta_1.SubtitleTrackMeta());
        default: return null;
    }
}
function unionListToMediaTrackMetadata(type, accessor, index) {
    switch (MediaTrackMetadata[type]) {
        case 'NONE': return null;
        case 'Video': return accessor(index, new video_track_meta_1.VideoTrackMeta());
        case 'Audio': return accessor(index, new audio_track_meta_1.AudioTrackMeta());
        case 'Subtitle': return accessor(index, new subtitle_track_meta_1.SubtitleTrackMeta());
        default: return null;
    }
}


/***/ }),

/***/ 1983:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FLAGS = exports.ERRSTR = void 0;
const constants_1 = __webpack_require__(2612);
exports.ERRSTR = {
    PATH_STR: 'path must be a string, Buffer, or Uint8Array',
    // FD:             'file descriptor must be a unsigned 32-bit integer',
    FD: 'fd must be a file descriptor',
    MODE_INT: 'mode must be an int',
    CB: 'callback must be a function',
    UID: 'uid must be an unsigned int',
    GID: 'gid must be an unsigned int',
    LEN: 'len must be an integer',
    ATIME: 'atime must be an integer',
    MTIME: 'mtime must be an integer',
    PREFIX: 'filename prefix is required',
    BUFFER: 'buffer must be an instance of Buffer or StaticBuffer',
    OFFSET: 'offset must be an integer',
    LENGTH: 'length must be an integer',
    POSITION: 'position must be an integer',
};
const { O_RDONLY, O_WRONLY, O_RDWR, O_CREAT, O_EXCL, O_TRUNC, O_APPEND, O_SYNC } = constants_1.constants;
// List of file `flags` as defined by Node.
var FLAGS;
(function (FLAGS) {
    // Open file for reading. An exception occurs if the file does not exist.
    FLAGS[FLAGS["r"] = O_RDONLY] = "r";
    // Open file for reading and writing. An exception occurs if the file does not exist.
    FLAGS[FLAGS["r+"] = O_RDWR] = "r+";
    // Open file for reading in synchronous mode. Instructs the operating system to bypass the local file system cache.
    FLAGS[FLAGS["rs"] = O_RDONLY | O_SYNC] = "rs";
    FLAGS[FLAGS["sr"] = FLAGS.rs] = "sr";
    // Open file for reading and writing, telling the OS to open it synchronously. See notes for 'rs' about using this with caution.
    FLAGS[FLAGS["rs+"] = O_RDWR | O_SYNC] = "rs+";
    FLAGS[FLAGS["sr+"] = FLAGS['rs+']] = "sr+";
    // Open file for writing. The file is created (if it does not exist) or truncated (if it exists).
    FLAGS[FLAGS["w"] = O_WRONLY | O_CREAT | O_TRUNC] = "w";
    // Like 'w' but fails if path exists.
    FLAGS[FLAGS["wx"] = O_WRONLY | O_CREAT | O_TRUNC | O_EXCL] = "wx";
    FLAGS[FLAGS["xw"] = FLAGS.wx] = "xw";
    // Open file for reading and writing. The file is created (if it does not exist) or truncated (if it exists).
    FLAGS[FLAGS["w+"] = O_RDWR | O_CREAT | O_TRUNC] = "w+";
    // Like 'w+' but fails if path exists.
    FLAGS[FLAGS["wx+"] = O_RDWR | O_CREAT | O_TRUNC | O_EXCL] = "wx+";
    FLAGS[FLAGS["xw+"] = FLAGS['wx+']] = "xw+";
    // Open file for appending. The file is created if it does not exist.
    FLAGS[FLAGS["a"] = O_WRONLY | O_APPEND | O_CREAT] = "a";
    // Like 'a' but fails if path exists.
    FLAGS[FLAGS["ax"] = O_WRONLY | O_APPEND | O_CREAT | O_EXCL] = "ax";
    FLAGS[FLAGS["xa"] = FLAGS.ax] = "xa";
    // Open file for reading and appending. The file is created if it does not exist.
    FLAGS[FLAGS["a+"] = O_RDWR | O_APPEND | O_CREAT] = "a+";
    // Like 'a+' but fails if path exists.
    FLAGS[FLAGS["ax+"] = O_RDWR | O_APPEND | O_CREAT | O_EXCL] = "ax+";
    FLAGS[FLAGS["xa+"] = FLAGS['ax+']] = "xa+";
})(FLAGS || (exports.FLAGS = FLAGS = {}));


/***/ }),

/***/ 2018:
/***/ ((module) => {

"use strict";
module.exports = require("tty");

/***/ }),

/***/ 2053:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Message = void 0;
exports.unionToMessage = unionToMessage;
exports.unionListToMessage = unionListToMessage;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const add_subtitle_source_1 = __webpack_require__(281);
const change_track_1 = __webpack_require__(6459);
const companion_hello_request_1 = __webpack_require__(5018);
const companion_hello_response_1 = __webpack_require__(8168);
const companion_resource_info_request_1 = __webpack_require__(4777);
const companion_resource_info_response_1 = __webpack_require__(7189);
const companion_resource_request_1 = __webpack_require__(2268);
const error_1 = __webpack_require__(1907);
const load_1 = __webpack_require__(4097);
const mirroring_session_description_1 = __webpack_require__(7466);
const playback_state_changed_1 = __webpack_require__(2757);
const progress_changed_1 = __webpack_require__(3091);
const queue_insert_1 = __webpack_require__(6762);
const queue_item_selected_1 = __webpack_require__(4340);
const queue_remove_1 = __webpack_require__(3463);
const receiver_introduction_1 = __webpack_require__(937);
const sender_introduction_1 = __webpack_require__(5765);
const set_progress_update_interval_1 = __webpack_require__(4281);
const speed_changed_1 = __webpack_require__(7699);
const start_mirroring_session_1 = __webpack_require__(6620);
const stop_playback_1 = __webpack_require__(6311);
const tracks_available_1 = __webpack_require__(4863);
const volume_changed_1 = __webpack_require__(1694);
var Message;
(function (Message) {
    Message[Message["NONE"] = 0] = "NONE";
    Message[Message["Load"] = 1] = "Load";
    Message[Message["ProgressChanged"] = 2] = "ProgressChanged";
    Message[Message["VolumeChanged"] = 3] = "VolumeChanged";
    Message[Message["PlaybackStateChanged"] = 4] = "PlaybackStateChanged";
    Message[Message["SpeedChanged"] = 5] = "SpeedChanged";
    Message[Message["SenderIntroduction"] = 6] = "SenderIntroduction";
    Message[Message["ReceiverIntroduction"] = 7] = "ReceiverIntroduction";
    Message[Message["StopPlayback"] = 8] = "StopPlayback";
    Message[Message["StartMirroringSession"] = 9] = "StartMirroringSession";
    Message[Message["MirroringSessionDescription"] = 10] = "MirroringSessionDescription";
    Message[Message["QueueInsert"] = 11] = "QueueInsert";
    Message[Message["QueueRemove"] = 12] = "QueueRemove";
    Message[Message["TracksAvailable"] = 13] = "TracksAvailable";
    Message[Message["ChangeTrack"] = 14] = "ChangeTrack";
    Message[Message["QueueItemSelected"] = 15] = "QueueItemSelected";
    Message[Message["AddSubtitleSource"] = 16] = "AddSubtitleSource";
    Message[Message["SetProgressUpdateInterval"] = 17] = "SetProgressUpdateInterval";
    Message[Message["CompanionHelloRequest"] = 18] = "CompanionHelloRequest";
    Message[Message["CompanionHelloResponse"] = 19] = "CompanionHelloResponse";
    Message[Message["CompanionResourceInfoRequest"] = 20] = "CompanionResourceInfoRequest";
    Message[Message["CompanionResourceInfoResponse"] = 21] = "CompanionResourceInfoResponse";
    Message[Message["CompanionResourceRequest"] = 22] = "CompanionResourceRequest";
    Message[Message["Error"] = 23] = "Error";
})(Message || (exports.Message = Message = {}));
function unionToMessage(type, accessor) {
    switch (Message[type]) {
        case 'NONE': return null;
        case 'Load': return accessor(new load_1.Load());
        case 'ProgressChanged': return accessor(new progress_changed_1.ProgressChanged());
        case 'VolumeChanged': return accessor(new volume_changed_1.VolumeChanged());
        case 'PlaybackStateChanged': return accessor(new playback_state_changed_1.PlaybackStateChanged());
        case 'SpeedChanged': return accessor(new speed_changed_1.SpeedChanged());
        case 'SenderIntroduction': return accessor(new sender_introduction_1.SenderIntroduction());
        case 'ReceiverIntroduction': return accessor(new receiver_introduction_1.ReceiverIntroduction());
        case 'StopPlayback': return accessor(new stop_playback_1.StopPlayback());
        case 'StartMirroringSession': return accessor(new start_mirroring_session_1.StartMirroringSession());
        case 'MirroringSessionDescription': return accessor(new mirroring_session_description_1.MirroringSessionDescription());
        case 'QueueInsert': return accessor(new queue_insert_1.QueueInsert());
        case 'QueueRemove': return accessor(new queue_remove_1.QueueRemove());
        case 'TracksAvailable': return accessor(new tracks_available_1.TracksAvailable());
        case 'ChangeTrack': return accessor(new change_track_1.ChangeTrack());
        case 'QueueItemSelected': return accessor(new queue_item_selected_1.QueueItemSelected());
        case 'AddSubtitleSource': return accessor(new add_subtitle_source_1.AddSubtitleSource());
        case 'SetProgressUpdateInterval': return accessor(new set_progress_update_interval_1.SetProgressUpdateInterval());
        case 'CompanionHelloRequest': return accessor(new companion_hello_request_1.CompanionHelloRequest());
        case 'CompanionHelloResponse': return accessor(new companion_hello_response_1.CompanionHelloResponse());
        case 'CompanionResourceInfoRequest': return accessor(new companion_resource_info_request_1.CompanionResourceInfoRequest());
        case 'CompanionResourceInfoResponse': return accessor(new companion_resource_info_response_1.CompanionResourceInfoResponse());
        case 'CompanionResourceRequest': return accessor(new companion_resource_request_1.CompanionResourceRequest());
        case 'Error': return accessor(new error_1.Error());
        default: return null;
    }
}
function unionListToMessage(type, accessor, index) {
    switch (Message[type]) {
        case 'NONE': return null;
        case 'Load': return accessor(index, new load_1.Load());
        case 'ProgressChanged': return accessor(index, new progress_changed_1.ProgressChanged());
        case 'VolumeChanged': return accessor(index, new volume_changed_1.VolumeChanged());
        case 'PlaybackStateChanged': return accessor(index, new playback_state_changed_1.PlaybackStateChanged());
        case 'SpeedChanged': return accessor(index, new speed_changed_1.SpeedChanged());
        case 'SenderIntroduction': return accessor(index, new sender_introduction_1.SenderIntroduction());
        case 'ReceiverIntroduction': return accessor(index, new receiver_introduction_1.ReceiverIntroduction());
        case 'StopPlayback': return accessor(index, new stop_playback_1.StopPlayback());
        case 'StartMirroringSession': return accessor(index, new start_mirroring_session_1.StartMirroringSession());
        case 'MirroringSessionDescription': return accessor(index, new mirroring_session_description_1.MirroringSessionDescription());
        case 'QueueInsert': return accessor(index, new queue_insert_1.QueueInsert());
        case 'QueueRemove': return accessor(index, new queue_remove_1.QueueRemove());
        case 'TracksAvailable': return accessor(index, new tracks_available_1.TracksAvailable());
        case 'ChangeTrack': return accessor(index, new change_track_1.ChangeTrack());
        case 'QueueItemSelected': return accessor(index, new queue_item_selected_1.QueueItemSelected());
        case 'AddSubtitleSource': return accessor(index, new add_subtitle_source_1.AddSubtitleSource());
        case 'SetProgressUpdateInterval': return accessor(index, new set_progress_update_interval_1.SetProgressUpdateInterval());
        case 'CompanionHelloRequest': return accessor(index, new companion_hello_request_1.CompanionHelloRequest());
        case 'CompanionHelloResponse': return accessor(index, new companion_hello_response_1.CompanionHelloResponse());
        case 'CompanionResourceInfoRequest': return accessor(index, new companion_resource_info_request_1.CompanionResourceInfoRequest());
        case 'CompanionResourceInfoResponse': return accessor(index, new companion_resource_info_response_1.CompanionResourceInfoResponse());
        case 'CompanionResourceRequest': return accessor(index, new companion_resource_request_1.CompanionResourceRequest());
        case 'Error': return accessor(index, new error_1.Error());
        default: return null;
    }
}


/***/ }),

/***/ 2119:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.QueueMarkerFront = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class QueueMarkerFront {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsQueueMarkerFront(bb, obj) {
        return (obj || new QueueMarkerFront()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsQueueMarkerFront(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new QueueMarkerFront()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static startQueueMarkerFront(builder) {
        builder.startObject(0);
    }
    static endQueueMarkerFront(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createQueueMarkerFront(builder) {
        QueueMarkerFront.startQueueMarkerFront(builder);
        return QueueMarkerFront.endQueueMarkerFront(builder);
    }
}
exports.QueueMarkerFront = QueueMarkerFront;


/***/ }),

/***/ 2126:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DisplayCapabilities = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const video_resolution_1 = __webpack_require__(813);
class DisplayCapabilities {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsDisplayCapabilities(bb, obj) {
        return (obj || new DisplayCapabilities()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsDisplayCapabilities(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new DisplayCapabilities()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    resolution(obj) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? (obj || new video_resolution_1.VideoResolution()).__init(this.bb_pos + offset, this.bb) : null;
    }
    static startDisplayCapabilities(builder) {
        builder.startObject(1);
    }
    static addResolution(builder, resolutionOffset) {
        builder.addFieldStruct(0, resolutionOffset, 0);
    }
    static endDisplayCapabilities(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createDisplayCapabilities(builder, resolutionOffset) {
        DisplayCapabilities.startDisplayCapabilities(builder);
        DisplayCapabilities.addResolution(builder, resolutionOffset);
        return DisplayCapabilities.endDisplayCapabilities(builder);
    }
}
exports.DisplayCapabilities = DisplayCapabilities;


/***/ }),

/***/ 2203:
/***/ ((module) => {

"use strict";
module.exports = require("stream");

/***/ }),

/***/ 2268:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CompanionResourceRequest = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const resource_read_head_1 = __webpack_require__(1085);
class CompanionResourceRequest {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsCompanionResourceRequest(bb, obj) {
        return (obj || new CompanionResourceRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsCompanionResourceRequest(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new CompanionResourceRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    requestId() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readUint32(this.bb_pos + offset) : 0;
    }
    resourceId() {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.readUint32(this.bb_pos + offset) : 0;
    }
    readHead(obj) {
        const offset = this.bb.__offset(this.bb_pos, 8);
        return offset ? (obj || new resource_read_head_1.ResourceReadHead()).__init(this.bb_pos + offset, this.bb) : null;
    }
    static startCompanionResourceRequest(builder) {
        builder.startObject(3);
    }
    static addRequestId(builder, requestId) {
        builder.addFieldInt32(0, requestId, 0);
    }
    static addResourceId(builder, resourceId) {
        builder.addFieldInt32(1, resourceId, 0);
    }
    static addReadHead(builder, readHeadOffset) {
        builder.addFieldStruct(2, readHeadOffset, 0);
    }
    static endCompanionResourceRequest(builder) {
        const offset = builder.endObject();
        return offset;
    }
}
exports.CompanionResourceRequest = CompanionResourceRequest;


/***/ }),

/***/ 2292:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MediaCapabilities = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class MediaCapabilities {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsMediaCapabilities(bb, obj) {
        return (obj || new MediaCapabilities()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsMediaCapabilities(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new MediaCapabilities()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    protocols(index, optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.__string(this.bb.__vector(this.bb_pos + offset) + index * 4, optionalEncoding) : null;
    }
    protocolsLength() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
    }
    containers(index, optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.__string(this.bb.__vector(this.bb_pos + offset) + index * 4, optionalEncoding) : null;
    }
    containersLength() {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
    }
    videoFormats(index, optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 8);
        return offset ? this.bb.__string(this.bb.__vector(this.bb_pos + offset) + index * 4, optionalEncoding) : null;
    }
    videoFormatsLength() {
        const offset = this.bb.__offset(this.bb_pos, 8);
        return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
    }
    audioFormats(index, optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 10);
        return offset ? this.bb.__string(this.bb.__vector(this.bb_pos + offset) + index * 4, optionalEncoding) : null;
    }
    audioFormatsLength() {
        const offset = this.bb.__offset(this.bb_pos, 10);
        return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
    }
    subtitleFormats(index, optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 12);
        return offset ? this.bb.__string(this.bb.__vector(this.bb_pos + offset) + index * 4, optionalEncoding) : null;
    }
    subtitleFormatsLength() {
        const offset = this.bb.__offset(this.bb_pos, 12);
        return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
    }
    hdrFormats(index, optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 14);
        return offset ? this.bb.__string(this.bb.__vector(this.bb_pos + offset) + index * 4, optionalEncoding) : null;
    }
    hdrFormatsLength() {
        const offset = this.bb.__offset(this.bb_pos, 14);
        return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
    }
    imageFormats(index, optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 16);
        return offset ? this.bb.__string(this.bb.__vector(this.bb_pos + offset) + index * 4, optionalEncoding) : null;
    }
    imageFormatsLength() {
        const offset = this.bb.__offset(this.bb_pos, 16);
        return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
    }
    externalSubtitles() {
        const offset = this.bb.__offset(this.bb_pos, 18);
        return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false;
    }
    mirroring() {
        const offset = this.bb.__offset(this.bb_pos, 20);
        return offset ? !!this.bb.readInt8(this.bb_pos + offset) : false;
    }
    static startMediaCapabilities(builder) {
        builder.startObject(9);
    }
    static addProtocols(builder, protocolsOffset) {
        builder.addFieldOffset(0, protocolsOffset, 0);
    }
    static createProtocolsVector(builder, data) {
        builder.startVector(4, data.length, 4);
        for (let i = data.length - 1; i >= 0; i--) {
            builder.addOffset(data[i]);
        }
        return builder.endVector();
    }
    static startProtocolsVector(builder, numElems) {
        builder.startVector(4, numElems, 4);
    }
    static addContainers(builder, containersOffset) {
        builder.addFieldOffset(1, containersOffset, 0);
    }
    static createContainersVector(builder, data) {
        builder.startVector(4, data.length, 4);
        for (let i = data.length - 1; i >= 0; i--) {
            builder.addOffset(data[i]);
        }
        return builder.endVector();
    }
    static startContainersVector(builder, numElems) {
        builder.startVector(4, numElems, 4);
    }
    static addVideoFormats(builder, videoFormatsOffset) {
        builder.addFieldOffset(2, videoFormatsOffset, 0);
    }
    static createVideoFormatsVector(builder, data) {
        builder.startVector(4, data.length, 4);
        for (let i = data.length - 1; i >= 0; i--) {
            builder.addOffset(data[i]);
        }
        return builder.endVector();
    }
    static startVideoFormatsVector(builder, numElems) {
        builder.startVector(4, numElems, 4);
    }
    static addAudioFormats(builder, audioFormatsOffset) {
        builder.addFieldOffset(3, audioFormatsOffset, 0);
    }
    static createAudioFormatsVector(builder, data) {
        builder.startVector(4, data.length, 4);
        for (let i = data.length - 1; i >= 0; i--) {
            builder.addOffset(data[i]);
        }
        return builder.endVector();
    }
    static startAudioFormatsVector(builder, numElems) {
        builder.startVector(4, numElems, 4);
    }
    static addSubtitleFormats(builder, subtitleFormatsOffset) {
        builder.addFieldOffset(4, subtitleFormatsOffset, 0);
    }
    static createSubtitleFormatsVector(builder, data) {
        builder.startVector(4, data.length, 4);
        for (let i = data.length - 1; i >= 0; i--) {
            builder.addOffset(data[i]);
        }
        return builder.endVector();
    }
    static startSubtitleFormatsVector(builder, numElems) {
        builder.startVector(4, numElems, 4);
    }
    static addHdrFormats(builder, hdrFormatsOffset) {
        builder.addFieldOffset(5, hdrFormatsOffset, 0);
    }
    static createHdrFormatsVector(builder, data) {
        builder.startVector(4, data.length, 4);
        for (let i = data.length - 1; i >= 0; i--) {
            builder.addOffset(data[i]);
        }
        return builder.endVector();
    }
    static startHdrFormatsVector(builder, numElems) {
        builder.startVector(4, numElems, 4);
    }
    static addImageFormats(builder, imageFormatsOffset) {
        builder.addFieldOffset(6, imageFormatsOffset, 0);
    }
    static createImageFormatsVector(builder, data) {
        builder.startVector(4, data.length, 4);
        for (let i = data.length - 1; i >= 0; i--) {
            builder.addOffset(data[i]);
        }
        return builder.endVector();
    }
    static startImageFormatsVector(builder, numElems) {
        builder.startVector(4, numElems, 4);
    }
    static addExternalSubtitles(builder, externalSubtitles) {
        builder.addFieldInt8(7, +externalSubtitles, +false);
    }
    static addMirroring(builder, mirroring) {
        builder.addFieldInt8(8, +mirroring, +false);
    }
    static endMediaCapabilities(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createMediaCapabilities(builder, protocolsOffset, containersOffset, videoFormatsOffset, audioFormatsOffset, subtitleFormatsOffset, hdrFormatsOffset, imageFormatsOffset, externalSubtitles, mirroring) {
        MediaCapabilities.startMediaCapabilities(builder);
        MediaCapabilities.addProtocols(builder, protocolsOffset);
        MediaCapabilities.addContainers(builder, containersOffset);
        MediaCapabilities.addVideoFormats(builder, videoFormatsOffset);
        MediaCapabilities.addAudioFormats(builder, audioFormatsOffset);
        MediaCapabilities.addSubtitleFormats(builder, subtitleFormatsOffset);
        MediaCapabilities.addHdrFormats(builder, hdrFormatsOffset);
        MediaCapabilities.addImageFormats(builder, imageFormatsOffset);
        MediaCapabilities.addExternalSubtitles(builder, externalSubtitles);
        MediaCapabilities.addMirroring(builder, mirroring);
        return MediaCapabilities.endMediaCapabilities(builder);
    }
}
exports.MediaCapabilities = MediaCapabilities;


/***/ }),

/***/ 2555:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ToastIcon = void 0;
exports.toast = toast;
var ToastIcon;
(function (ToastIcon) {
    ToastIcon[ToastIcon["INFO"] = 0] = "INFO";
    ToastIcon[ToastIcon["WARNING"] = 1] = "WARNING";
    ToastIcon[ToastIcon["ERROR"] = 2] = "ERROR";
})(ToastIcon || (exports.ToastIcon = ToastIcon = {}));
const toastQueue = [];
function toast(message, icon = ToastIcon.INFO, duration = 5000) {
    toastQueue.push({ message: message, icon: icon, duration: duration });
    if (toastQueue.length === 1) {
        renderToast(message, icon, duration);
    }
}
function renderToast(message, icon = ToastIcon.INFO, duration = 5000) {
    const toastNotification = document.getElementById('toast-notification');
    const toastIcon = document.getElementById('toast-icon');
    const toastText = document.getElementById('toast-text');
    if (!(toastNotification && toastIcon && toastText)) {
        throw 'Toast component could not be initialized';
    }
    window.setTimeout(() => {
        toastNotification.className = 'toast-fade-out';
        toastNotification.style.opacity = '0';
        toastQueue.shift();
        if (toastQueue.length > 0) {
            window.setTimeout(() => {
                let toast = toastQueue[0];
                renderToast(toast.message, toast.icon, toast.duration);
            }, 1000);
        }
    }, duration);
    switch (icon) {
        case ToastIcon.INFO:
            toastIcon.style.backgroundImage = 'url(../assets/icons/app/info.svg)';
            break;
        case ToastIcon.WARNING:
            toastIcon.style.backgroundImage = 'url(../assets/icons/app/warning.svg)';
            break;
        case ToastIcon.ERROR:
            toastIcon.style.backgroundImage = 'url(../assets/icons/app/error.svg)';
            break;
        default:
            break;
    }
    toastText.textContent = message;
    toastNotification.className = 'toast-fade-in';
    toastNotification.style.opacity = '1';
}


/***/ }),

/***/ 2561:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MediaItem = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const metadata_1 = __webpack_require__(6496);
const metadata_kv_1 = __webpack_require__(4560);
const request_header_1 = __webpack_require__(756);
const time_1 = __webpack_require__(6004);
class MediaItem {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsMediaItem(bb, obj) {
        return (obj || new MediaItem()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsMediaItem(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new MediaItem()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    container(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    sourceUrl(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    startTime(obj) {
        const offset = this.bb.__offset(this.bb_pos, 8);
        return offset ? (obj || new time_1.Time()).__init(this.bb_pos + offset, this.bb) : null;
    }
    volume() {
        const offset = this.bb.__offset(this.bb_pos, 10);
        return offset ? this.bb.readFloat32(this.bb_pos + offset) : null;
    }
    speed() {
        const offset = this.bb.__offset(this.bb_pos, 12);
        return offset ? this.bb.readFloat32(this.bb_pos + offset) : null;
    }
    headers(index, obj) {
        const offset = this.bb.__offset(this.bb_pos, 14);
        return offset ? (obj || new request_header_1.RequestHeader()).__init(this.bb.__indirect(this.bb.__vector(this.bb_pos + offset) + index * 4), this.bb) : null;
    }
    headersLength() {
        const offset = this.bb.__offset(this.bb_pos, 14);
        return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
    }
    title(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 16);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    thumbnailUrl(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 18);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    metadataType() {
        const offset = this.bb.__offset(this.bb_pos, 20);
        return offset ? this.bb.readUint8(this.bb_pos + offset) : metadata_1.Metadata.NONE;
    }
    metadata(obj) {
        const offset = this.bb.__offset(this.bb_pos, 22);
        return offset ? this.bb.__union(obj, this.bb_pos + offset) : null;
    }
    extraMetadata(index, obj) {
        const offset = this.bb.__offset(this.bb_pos, 24);
        return offset ? (obj || new metadata_kv_1.MetadataKV()).__init(this.bb.__indirect(this.bb.__vector(this.bb_pos + offset) + index * 4), this.bb) : null;
    }
    extraMetadataLength() {
        const offset = this.bb.__offset(this.bb_pos, 24);
        return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
    }
    static startMediaItem(builder) {
        builder.startObject(11);
    }
    static addContainer(builder, containerOffset) {
        builder.addFieldOffset(0, containerOffset, 0);
    }
    static addSourceUrl(builder, sourceUrlOffset) {
        builder.addFieldOffset(1, sourceUrlOffset, 0);
    }
    static addStartTime(builder, startTimeOffset) {
        builder.addFieldStruct(2, startTimeOffset, 0);
    }
    static addVolume(builder, volume) {
        builder.addFieldFloat32(3, volume, null);
    }
    static addSpeed(builder, speed) {
        builder.addFieldFloat32(4, speed, null);
    }
    static addHeaders(builder, headersOffset) {
        builder.addFieldOffset(5, headersOffset, 0);
    }
    static createHeadersVector(builder, data) {
        builder.startVector(4, data.length, 4);
        for (let i = data.length - 1; i >= 0; i--) {
            builder.addOffset(data[i]);
        }
        return builder.endVector();
    }
    static startHeadersVector(builder, numElems) {
        builder.startVector(4, numElems, 4);
    }
    static addTitle(builder, titleOffset) {
        builder.addFieldOffset(6, titleOffset, 0);
    }
    static addThumbnailUrl(builder, thumbnailUrlOffset) {
        builder.addFieldOffset(7, thumbnailUrlOffset, 0);
    }
    static addMetadataType(builder, metadataType) {
        builder.addFieldInt8(8, metadataType, metadata_1.Metadata.NONE);
    }
    static addMetadata(builder, metadataOffset) {
        builder.addFieldOffset(9, metadataOffset, 0);
    }
    static addExtraMetadata(builder, extraMetadataOffset) {
        builder.addFieldOffset(10, extraMetadataOffset, 0);
    }
    static createExtraMetadataVector(builder, data) {
        builder.startVector(4, data.length, 4);
        for (let i = data.length - 1; i >= 0; i--) {
            builder.addOffset(data[i]);
        }
        return builder.endVector();
    }
    static startExtraMetadataVector(builder, numElems) {
        builder.startVector(4, numElems, 4);
    }
    static endMediaItem(builder) {
        const offset = builder.endObject();
        builder.requiredField(offset, 4); // container
        builder.requiredField(offset, 6); // source_url
        return offset;
    }
}
exports.MediaItem = MediaItem;


/***/ }),

/***/ 2612:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.constants = void 0;
exports.constants = {
    O_RDONLY: 0,
    O_WRONLY: 1,
    O_RDWR: 2,
    S_IFMT: 61440,
    S_IFREG: 32768,
    S_IFDIR: 16384,
    S_IFCHR: 8192,
    S_IFBLK: 24576,
    S_IFIFO: 4096,
    S_IFLNK: 40960,
    S_IFSOCK: 49152,
    O_CREAT: 64,
    O_EXCL: 128,
    O_NOCTTY: 256,
    O_TRUNC: 512,
    O_APPEND: 1024,
    O_DIRECTORY: 65536,
    O_NOATIME: 262144,
    O_NOFOLLOW: 131072,
    O_SYNC: 1052672,
    O_SYMLINK: 2097152,
    O_DIRECT: 16384,
    O_NONBLOCK: 2048,
    S_IRWXU: 448,
    S_IRUSR: 256,
    S_IWUSR: 128,
    S_IXUSR: 64,
    S_IRWXG: 56,
    S_IRGRP: 32,
    S_IWGRP: 16,
    S_IXGRP: 8,
    S_IRWXO: 7,
    S_IROTH: 4,
    S_IWOTH: 2,
    S_IXOTH: 1,
    F_OK: 0,
    R_OK: 4,
    W_OK: 2,
    X_OK: 1,
    UV_FS_SYMLINK_DIR: 1,
    UV_FS_SYMLINK_JUNCTION: 2,
    UV_FS_COPYFILE_EXCL: 1,
    UV_FS_COPYFILE_FICLONE: 2,
    UV_FS_COPYFILE_FICLONE_FORCE: 4,
    COPYFILE_EXCL: 1,
    COPYFILE_FICLONE: 2,
    COPYFILE_FICLONE_FORCE: 4,
};


/***/ }),

/***/ 2613:
/***/ ((module) => {

"use strict";
module.exports = require("assert");

/***/ }),

/***/ 2708:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ENCODING_UTF8 = void 0;
exports.assertEncoding = assertEncoding;
exports.strToEncoding = strToEncoding;
const buffer_1 = __webpack_require__(9897);
const errors = __webpack_require__(9608);
exports.ENCODING_UTF8 = 'utf8';
function assertEncoding(encoding) {
    if (encoding && !buffer_1.Buffer.isEncoding(encoding))
        throw new errors.TypeError('ERR_INVALID_OPT_VALUE_ENCODING', encoding);
}
function strToEncoding(str, encoding) {
    if (!encoding || encoding === exports.ENCODING_UTF8)
        return str; // UTF-8
    if (encoding === 'buffer')
        return new buffer_1.Buffer(str); // `buffer` encoding
    return new buffer_1.Buffer(str).toString(encoding); // Custom encoding
}


/***/ }),

/***/ 2757:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.PlaybackStateChanged = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const playback_state_1 = __webpack_require__(324);
class PlaybackStateChanged {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsPlaybackStateChanged(bb, obj) {
        return (obj || new PlaybackStateChanged()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsPlaybackStateChanged(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new PlaybackStateChanged()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    state() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readUint8(this.bb_pos + offset) : playback_state_1.PlaybackState.Idle;
    }
    static startPlaybackStateChanged(builder) {
        builder.startObject(1);
    }
    static addState(builder, state) {
        builder.addFieldInt8(0, state, playback_state_1.PlaybackState.Idle);
    }
    static endPlaybackStateChanged(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createPlaybackStateChanged(builder, state) {
        PlaybackStateChanged.startPlaybackStateChanged(builder);
        PlaybackStateChanged.addState(builder, state);
        return PlaybackStateChanged.endPlaybackStateChanged(builder);
    }
}
exports.PlaybackStateChanged = PlaybackStateChanged;


/***/ }),

/***/ 2851:
/***/ ((__unused_webpack___webpack_module__, __webpack_exports__, __webpack_require__) => {

"use strict";
__webpack_require__.r(__webpack_exports__);
/* harmony export */ __webpack_require__.d(__webpack_exports__, {
/* harmony export */   __addDisposableResource: () => (/* binding */ __addDisposableResource),
/* harmony export */   __assign: () => (/* binding */ __assign),
/* harmony export */   __asyncDelegator: () => (/* binding */ __asyncDelegator),
/* harmony export */   __asyncGenerator: () => (/* binding */ __asyncGenerator),
/* harmony export */   __asyncValues: () => (/* binding */ __asyncValues),
/* harmony export */   __await: () => (/* binding */ __await),
/* harmony export */   __awaiter: () => (/* binding */ __awaiter),
/* harmony export */   __classPrivateFieldGet: () => (/* binding */ __classPrivateFieldGet),
/* harmony export */   __classPrivateFieldIn: () => (/* binding */ __classPrivateFieldIn),
/* harmony export */   __classPrivateFieldSet: () => (/* binding */ __classPrivateFieldSet),
/* harmony export */   __createBinding: () => (/* binding */ __createBinding),
/* harmony export */   __decorate: () => (/* binding */ __decorate),
/* harmony export */   __disposeResources: () => (/* binding */ __disposeResources),
/* harmony export */   __esDecorate: () => (/* binding */ __esDecorate),
/* harmony export */   __exportStar: () => (/* binding */ __exportStar),
/* harmony export */   __extends: () => (/* binding */ __extends),
/* harmony export */   __generator: () => (/* binding */ __generator),
/* harmony export */   __importDefault: () => (/* binding */ __importDefault),
/* harmony export */   __importStar: () => (/* binding */ __importStar),
/* harmony export */   __makeTemplateObject: () => (/* binding */ __makeTemplateObject),
/* harmony export */   __metadata: () => (/* binding */ __metadata),
/* harmony export */   __param: () => (/* binding */ __param),
/* harmony export */   __propKey: () => (/* binding */ __propKey),
/* harmony export */   __read: () => (/* binding */ __read),
/* harmony export */   __rest: () => (/* binding */ __rest),
/* harmony export */   __rewriteRelativeImportExtension: () => (/* binding */ __rewriteRelativeImportExtension),
/* harmony export */   __runInitializers: () => (/* binding */ __runInitializers),
/* harmony export */   __setFunctionName: () => (/* binding */ __setFunctionName),
/* harmony export */   __spread: () => (/* binding */ __spread),
/* harmony export */   __spreadArray: () => (/* binding */ __spreadArray),
/* harmony export */   __spreadArrays: () => (/* binding */ __spreadArrays),
/* harmony export */   __values: () => (/* binding */ __values),
/* harmony export */   "default": () => (__WEBPACK_DEFAULT_EXPORT__)
/* harmony export */ });
/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global Reflect, Promise, SuppressedError, Symbol, Iterator */
var extendStatics = function (d, b) {
    extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b)
            if (Object.prototype.hasOwnProperty.call(b, p))
                d[p] = b[p]; };
    return extendStatics(d, b);
};
function __extends(d, b) {
    if (typeof b !== "function" && b !== null)
        throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
    extendStatics(d, b);
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
}
var __assign = function () {
    __assign = Object.assign || function __assign(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s)
                if (Object.prototype.hasOwnProperty.call(s, p))
                    t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
function __rest(s, e) {
    var t = {};
    for (var p in s)
        if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
            t[p] = s[p];
    if (s != null && typeof Object.getOwnPropertySymbols === "function")
        for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
            if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                t[p[i]] = s[p[i]];
        }
    return t;
}
function __decorate(decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function")
        r = Reflect.decorate(decorators, target, key, desc);
    else
        for (var i = decorators.length - 1; i >= 0; i--)
            if (d = decorators[i])
                r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
}
function __param(paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); };
}
function __esDecorate(ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
    function accept(f) { if (f !== void 0 && typeof f !== "function")
        throw new TypeError("Function expected"); return f; }
    var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
    var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
    var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
    var _, done = false;
    for (var i = decorators.length - 1; i >= 0; i--) {
        var context = {};
        for (var p in contextIn)
            context[p] = p === "access" ? {} : contextIn[p];
        for (var p in contextIn.access)
            context.access[p] = contextIn.access[p];
        context.addInitializer = function (f) { if (done)
            throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
        var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
        if (kind === "accessor") {
            if (result === void 0)
                continue;
            if (result === null || typeof result !== "object")
                throw new TypeError("Object expected");
            if (_ = accept(result.get))
                descriptor.get = _;
            if (_ = accept(result.set))
                descriptor.set = _;
            if (_ = accept(result.init))
                initializers.unshift(_);
        }
        else if (_ = accept(result)) {
            if (kind === "field")
                initializers.unshift(_);
            else
                descriptor[key] = _;
        }
    }
    if (target)
        Object.defineProperty(target, contextIn.name, descriptor);
    done = true;
}
;
function __runInitializers(thisArg, initializers, value) {
    var useValue = arguments.length > 2;
    for (var i = 0; i < initializers.length; i++) {
        value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
    }
    return useValue ? value : void 0;
}
;
function __propKey(x) {
    return typeof x === "symbol" ? x : "".concat(x);
}
;
function __setFunctionName(f, name, prefix) {
    if (typeof name === "symbol")
        name = name.description ? "[".concat(name.description, "]") : "";
    return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
}
;
function __metadata(metadataKey, metadataValue) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function")
        return Reflect.metadata(metadataKey, metadataValue);
}
function __awaiter(thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try {
            step(generator.next(value));
        }
        catch (e) {
            reject(e);
        } }
        function rejected(value) { try {
            step(generator["throw"](value));
        }
        catch (e) {
            reject(e);
        } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
}
function __generator(thisArg, body) {
    var _ = { label: 0, sent: function () { if (t[0] & 1)
            throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function () { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f)
            throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _)
            try {
                if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done)
                    return t;
                if (y = 0, t)
                    op = [op[0] & 2, t.value];
                switch (op[0]) {
                    case 0:
                    case 1:
                        t = op;
                        break;
                    case 4:
                        _.label++;
                        return { value: op[1], done: false };
                    case 5:
                        _.label++;
                        y = op[1];
                        op = [0];
                        continue;
                    case 7:
                        op = _.ops.pop();
                        _.trys.pop();
                        continue;
                    default:
                        if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) {
                            _ = 0;
                            continue;
                        }
                        if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) {
                            _.label = op[1];
                            break;
                        }
                        if (op[0] === 6 && _.label < t[1]) {
                            _.label = t[1];
                            t = op;
                            break;
                        }
                        if (t && _.label < t[2]) {
                            _.label = t[2];
                            _.ops.push(op);
                            break;
                        }
                        if (t[2])
                            _.ops.pop();
                        _.trys.pop();
                        continue;
                }
                op = body.call(thisArg, _);
            }
            catch (e) {
                op = [6, e];
                y = 0;
            }
            finally {
                f = t = 0;
            }
        if (op[0] & 5)
            throw op[1];
        return { value: op[0] ? op[1] : void 0, done: true };
    }
}
var __createBinding = Object.create ? (function (o, m, k, k2) {
    if (k2 === undefined)
        k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
        desc = { enumerable: true, get: function () { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function (o, m, k, k2) {
    if (k2 === undefined)
        k2 = k;
    o[k2] = m[k];
});
function __exportStar(m, o) {
    for (var p in m)
        if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p))
            __createBinding(o, m, p);
}
function __values(o) {
    var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
    if (m)
        return m.call(o);
    if (o && typeof o.length === "number")
        return {
            next: function () {
                if (o && i >= o.length)
                    o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
    throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
}
function __read(o, n) {
    var m = typeof Symbol === "function" && o[Symbol.iterator];
    if (!m)
        return o;
    var i = m.call(o), r, ar = [], e;
    try {
        while ((n === void 0 || n-- > 0) && !(r = i.next()).done)
            ar.push(r.value);
    }
    catch (error) {
        e = { error: error };
    }
    finally {
        try {
            if (r && !r.done && (m = i["return"]))
                m.call(i);
        }
        finally {
            if (e)
                throw e.error;
        }
    }
    return ar;
}
/** @deprecated */
function __spread() {
    for (var ar = [], i = 0; i < arguments.length; i++)
        ar = ar.concat(__read(arguments[i]));
    return ar;
}
/** @deprecated */
function __spreadArrays() {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++)
        s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
}
function __spreadArray(to, from, pack) {
    if (pack || arguments.length === 2)
        for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
                if (!ar)
                    ar = Array.prototype.slice.call(from, 0, i);
                ar[i] = from[i];
            }
        }
    return to.concat(ar || Array.prototype.slice.call(from));
}
function __await(v) {
    return this instanceof __await ? (this.v = v, this) : new __await(v);
}
function __asyncGenerator(thisArg, _arguments, generator) {
    if (!Symbol.asyncIterator)
        throw new TypeError("Symbol.asyncIterator is not defined.");
    var g = generator.apply(thisArg, _arguments || []), i, q = [];
    return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
    function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
    function verb(n, f) { if (g[n]) {
        i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); };
        if (f)
            i[n] = f(i[n]);
    } }
    function resume(n, v) { try {
        step(g[n](v));
    }
    catch (e) {
        settle(q[0][3], e);
    } }
    function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
    function fulfill(value) { resume("next", value); }
    function reject(value) { resume("throw", value); }
    function settle(f, v) { if (f(v), q.shift(), q.length)
        resume(q[0][0], q[0][1]); }
}
function __asyncDelegator(o) {
    var i, p;
    return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
    function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v; } : f; }
}
function __asyncValues(o) {
    if (!Symbol.asyncIterator)
        throw new TypeError("Symbol.asyncIterator is not defined.");
    var m = o[Symbol.asyncIterator], i;
    return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
    function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
    function settle(resolve, reject, d, v) { Promise.resolve(v).then(function (v) { resolve({ value: v, done: d }); }, reject); }
}
function __makeTemplateObject(cooked, raw) {
    if (Object.defineProperty) {
        Object.defineProperty(cooked, "raw", { value: raw });
    }
    else {
        cooked.raw = raw;
    }
    return cooked;
}
;
var __setModuleDefault = Object.create ? (function (o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function (o, v) {
    o["default"] = v;
};
var ownKeys = function (o) {
    ownKeys = Object.getOwnPropertyNames || function (o) {
        var ar = [];
        for (var k in o)
            if (Object.prototype.hasOwnProperty.call(o, k))
                ar[ar.length] = k;
        return ar;
    };
    return ownKeys(o);
};
function __importStar(mod) {
    if (mod && mod.__esModule)
        return mod;
    var result = {};
    if (mod != null)
        for (var k = ownKeys(mod), i = 0; i < k.length; i++)
            if (k[i] !== "default")
                __createBinding(result, mod, k[i]);
    __setModuleDefault(result, mod);
    return result;
}
function __importDefault(mod) {
    return (mod && mod.__esModule) ? mod : { default: mod };
}
function __classPrivateFieldGet(receiver, state, kind, f) {
    if (kind === "a" && !f)
        throw new TypeError("Private accessor was defined without a getter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
        throw new TypeError("Cannot read private member from an object whose class did not declare it");
    return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
}
function __classPrivateFieldSet(receiver, state, value, kind, f) {
    if (kind === "m")
        throw new TypeError("Private method is not writable");
    if (kind === "a" && !f)
        throw new TypeError("Private accessor was defined without a setter");
    if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver))
        throw new TypeError("Cannot write private member to an object whose class did not declare it");
    return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
}
function __classPrivateFieldIn(state, receiver) {
    if (receiver === null || (typeof receiver !== "object" && typeof receiver !== "function"))
        throw new TypeError("Cannot use 'in' operator on non-object");
    return typeof state === "function" ? receiver === state : state.has(receiver);
}
function __addDisposableResource(env, value, async) {
    if (value !== null && value !== void 0) {
        if (typeof value !== "object" && typeof value !== "function")
            throw new TypeError("Object expected.");
        var dispose, inner;
        if (async) {
            if (!Symbol.asyncDispose)
                throw new TypeError("Symbol.asyncDispose is not defined.");
            dispose = value[Symbol.asyncDispose];
        }
        if (dispose === void 0) {
            if (!Symbol.dispose)
                throw new TypeError("Symbol.dispose is not defined.");
            dispose = value[Symbol.dispose];
            if (async)
                inner = dispose;
        }
        if (typeof dispose !== "function")
            throw new TypeError("Object not disposable.");
        if (inner)
            dispose = function () { try {
                inner.call(this);
            }
            catch (e) {
                return Promise.reject(e);
            } };
        env.stack.push({ value: value, dispose: dispose, async: async });
    }
    else if (async) {
        env.stack.push({ async: true });
    }
    return value;
}
var _SuppressedError = typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
    var e = new Error(message);
    return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
};
function __disposeResources(env) {
    function fail(e) {
        env.error = env.hasError ? new _SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
        env.hasError = true;
    }
    var r, s = 0;
    function next() {
        while (r = env.stack.pop()) {
            try {
                if (!r.async && s === 1)
                    return s = 0, env.stack.push(r), Promise.resolve().then(next);
                if (r.dispose) {
                    var result = r.dispose.call(r.value);
                    if (r.async)
                        return s |= 2, Promise.resolve(result).then(next, function (e) { fail(e); return next(); });
                }
                else
                    s |= 1;
            }
            catch (e) {
                fail(e);
            }
        }
        if (s === 1)
            return env.hasError ? Promise.reject(env.error) : Promise.resolve();
        if (env.hasError)
            throw env.error;
    }
    return next();
}
function __rewriteRelativeImportExtension(path, preserveJsx) {
    if (typeof path === "string" && /^\.\.?\//.test(path)) {
        return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
            return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
        });
    }
    return path;
}
/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = ({
    __extends,
    __assign,
    __rest,
    __decorate,
    __param,
    __esDecorate,
    __runInitializers,
    __propKey,
    __setFunctionName,
    __metadata,
    __awaiter,
    __generator,
    __createBinding,
    __exportStar,
    __values,
    __read,
    __spread,
    __spreadArrays,
    __spreadArray,
    __await,
    __asyncGenerator,
    __asyncDelegator,
    __asyncValues,
    __makeTemplateObject,
    __importStar,
    __importDefault,
    __classPrivateFieldGet,
    __classPrivateFieldSet,
    __classPrivateFieldIn,
    __addDisposableResource,
    __disposeResources,
    __rewriteRelativeImportExtension,
});


/***/ }),

/***/ 2887:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var debug;
module.exports = function () {
    if (!debug) {
        try {
            /* eslint global-require: off */
            debug = __webpack_require__(1357)("follow-redirects");
        }
        catch (error) { /* */ }
        if (typeof debug !== "function") {
            debug = function () { };
        }
    }
    debug.apply(null, arguments);
};


/***/ }),

/***/ 3091:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ProgressChanged = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const time_1 = __webpack_require__(6004);
class ProgressChanged {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsProgressChanged(bb, obj) {
        return (obj || new ProgressChanged()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsProgressChanged(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new ProgressChanged()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    position(obj) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? (obj || new time_1.Time()).__init(this.bb_pos + offset, this.bb) : null;
    }
    duration(obj) {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? (obj || new time_1.Time()).__init(this.bb_pos + offset, this.bb) : null;
    }
    static startProgressChanged(builder) {
        builder.startObject(2);
    }
    static addPosition(builder, positionOffset) {
        builder.addFieldStruct(0, positionOffset, 0);
    }
    static addDuration(builder, durationOffset) {
        builder.addFieldStruct(1, durationOffset, 0);
    }
    static endProgressChanged(builder) {
        const offset = builder.endObject();
        return offset;
    }
}
exports.ProgressChanged = ProgressChanged;


/***/ }),

/***/ 3196:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.V4PlaybackState = exports.Message = exports.ErrorKind = exports.V4DecodeError = exports.MAX_RESOURCE_READ_SIZE = exports.V4_MAX_PACKET_SIZE = exports.PLAYLIST_CONTAINER = void 0;
exports.playbackStateFromV4 = playbackStateFromV4;
exports.playbackStateToV4 = playbackStateToV4;
exports.decodeV4 = decodeV4;
exports.parseResourcePacket = parseResourcePacket;
exports.encodeResourcePacket = encodeResourcePacket;
exports.encodeReceiverIntroduction = encodeReceiverIntroduction;
exports.encodeVolumeChanged = encodeVolumeChanged;
exports.encodeSpeedChanged = encodeSpeedChanged;
exports.encodePlaybackStateChanged = encodePlaybackStateChanged;
exports.encodeProgressChanged = encodeProgressChanged;
exports.encodeQueueItemSelected = encodeQueueItemSelected;
exports.encodeQueueRemove = encodeQueueRemove;
exports.encodeStopPlayback = encodeStopPlayback;
exports.encodeError = encodeError;
exports.encodeTracksAvailable = encodeTracksAvailable;
exports.encodeChangeTrack = encodeChangeTrack;
exports.encodeCompanionHelloResponse = encodeCompanionHelloResponse;
exports.encodeCompanionResourceInfoRequest = encodeCompanionResourceInfoRequest;
exports.encodeCompanionResourceRequest = encodeCompanionResourceRequest;
exports.encodeMirroringSessionDescription = encodeMirroringSessionDescription;
exports.parsePlaylist = parsePlaylist;
exports.loadSourceOf = loadSourceOf;
exports.encodeLoadSource = encodeLoadSource;
exports.encodeLoad = encodeLoad;
exports.encodeQueueInsert = encodeQueueInsert;
exports.encodeSenderIntroduction = encodeSenderIntroduction;
exports.encodeAddSubtitleSource = encodeAddSubtitleSource;
exports.encodeSetProgressUpdateInterval = encodeSetProgressUpdateInterval;
exports.encodeStartMirroringSession = encodeStartMirroringSession;
exports.encodeCompanionHelloRequest = encodeCompanionHelloRequest;
exports.encodeCompanionResourceInfoResponse = encodeCompanionResourceInfoResponse;
const flatbuffers = __importStar(__webpack_require__(8706));
const v4_1 = __webpack_require__(82);
Object.defineProperty(exports, "ErrorKind", ({ enumerable: true, get: function () { return v4_1.ErrorKind; } }));
Object.defineProperty(exports, "Message", ({ enumerable: true, get: function () { return v4_1.Message; } }));
Object.defineProperty(exports, "V4PlaybackState", ({ enumerable: true, get: function () { return v4_1.PlaybackState; } }));
const Packets_1 = __webpack_require__(834);
// Protocol v4 FlatBuffers messages, translated to and from the v2/v3 message model that the rest
// of the receiver (players, listener services) is written against. Sender-side encoders are here
// too, for tests and tools.
exports.PLAYLIST_CONTAINER = 'application/json';
// v4 `MaxPacketSize` (opcode + body) and the largest resource read that fits one `Resource` packet
// (fcast-protocol companion::MAX_RESOURCE_READ_SIZE).
exports.V4_MAX_PACKET_SIZE = 512 * 1024;
const RESOURCE_HEADER_SIZE = 7; // request id (u32), part (u8), total parts (u8), result tag (u8)
exports.MAX_RESOURCE_READ_SIZE = exports.V4_MAX_PACKET_SIZE - RESOURCE_HEADER_SIZE - 1;
class V4DecodeError extends Error {
}
exports.V4DecodeError = V4DecodeError;
function secondsToMicros(seconds) {
    return BigInt(Math.max(0, Math.round(seconds * 1000000)));
}
function timeToSeconds(time) {
    return time ? Number(time.micros()) / 1000000 : null;
}
function finish(builder, type, payload) {
    builder.finish(v4_1.Packet.createPacket(builder, type, payload));
    return builder.asUint8Array();
}
function playbackStateFromV4(state) {
    switch (state) {
        case v4_1.PlaybackState.Playing:
        case v4_1.PlaybackState.Buffering:
            return Packets_1.PlaybackState.Playing;
        case v4_1.PlaybackState.Paused:
            return Packets_1.PlaybackState.Paused;
        default:
            return Packets_1.PlaybackState.Idle;
    }
}
function playbackStateToV4(state) {
    switch (state) {
        case Packets_1.PlaybackState.Playing:
            return v4_1.PlaybackState.Playing;
        case Packets_1.PlaybackState.Paused:
            return v4_1.PlaybackState.Paused;
        default:
            return v4_1.PlaybackState.Idle;
    }
}
const TRACK_TYPES = {
    video: v4_1.MediaTrackType.Video,
    audio: v4_1.MediaTrackType.Audio,
    subtitle: v4_1.MediaTrackType.Subtitle,
};
function trackTypeFromV4(type) {
    switch (type) {
        case v4_1.MediaTrackType.Video:
            return 'video';
        case v4_1.MediaTrackType.Audio:
            return 'audio';
        case v4_1.MediaTrackType.Subtitle:
            return 'subtitle';
        default:
            throw new V4DecodeError(`invalid track type ${type}`);
    }
}
// ---- Decoding (sender -> receiver) -----------------------------------------------------------
function headersFromV4(item) {
    if (item.headersLength() === 0) {
        return null;
    }
    const headers = {};
    for (let i = 0; i < item.headersLength(); i++) {
        const header = item.headers(i);
        headers[header.key()] = header.value();
    }
    return headers;
}
function metadataFromV4(item) {
    const title = item.title();
    const thumbnailUrl = item.thumbnailUrl();
    return title !== null || thumbnailUrl !== null ? new Packets_1.GenericMediaMetadata(title, thumbnailUrl) : null;
}
function requiredString(value, field) {
    if (value === null) {
        throw new V4DecodeError(`missing required field ${field}`);
    }
    return value;
}
function playMessageFromV4(item) {
    return new Packets_1.PlayMessage(requiredString(item.container(), 'container'), requiredString(item.sourceUrl(), 'source_url'), null, timeToSeconds(item.startTime()), item.volume(), item.speed(), headersFromV4(item), metadataFromV4(item));
}
function mediaItemFromV4(queueItem) {
    const item = queueItem.mediaItem();
    if (item === null) {
        throw new V4DecodeError('missing required field media_item');
    }
    return new Packets_1.MediaItem(requiredString(item.container(), 'container'), requiredString(item.sourceUrl(), 'source_url'), null, timeToSeconds(item.startTime()), item.volume(), item.speed(), null, timeToSeconds(queueItem.playbackDuration()), headersFromV4(item), metadataFromV4(item));
}
// A v4 queue maps onto a v3 playlist: a PlayMessage whose content is a PlaylistContent.
function playMessageFromV4Queue(queue) {
    const items = [];
    for (let i = 0; i < queue.itemsLength(); i++) {
        items.push(mediaItemFromV4(queue.items(i)));
    }
    const startIndex = queue.startIndex();
    const playlist = new Packets_1.PlaylistContent(items, startIndex !== null ? startIndex : 0);
    playlist.autoplay = queue.autoplay();
    return new Packets_1.PlayMessage(exports.PLAYLIST_CONTAINER, null, JSON.stringify(playlist));
}
function queuePositionFromV4(type, getIndex) {
    switch (type) {
        case v4_1.QueuePosition.Index:
            return { kind: 'index', index: getIndex().index() };
        case v4_1.QueuePosition.Front:
            return { kind: 'front' };
        case v4_1.QueuePosition.Back:
            return { kind: 'back' };
        default:
            throw new V4DecodeError(`invalid queue position ${type}`);
    }
}
// Decodes the body of a `Flatbuf` (opcode 20) packet.
function decodeV4(body) {
    // The JS FlatBuffers runtime has no verifier and reads past the end as `undefined`, so at least
    // make sure the root table and its vtable are inside the buffer. Deeper damage surfaces as
    // missing fields or exceptions, which the session reports as errors.
    const bb = new flatbuffers.ByteBuffer(body);
    if (body.length < 8) {
        throw new V4DecodeError(`packet too short: ${body.length} bytes`);
    }
    const root = bb.readUint32(0);
    if (root + 4 > body.length) {
        throw new V4DecodeError('root table out of bounds');
    }
    const vtable = root - bb.readInt32(root);
    if (vtable < 0 || vtable + 4 > body.length) {
        throw new V4DecodeError('vtable out of bounds');
    }
    const packet = v4_1.Packet.getRootAsPacket(bb);
    const type = packet.payloadType();
    const payload = (table) => {
        const value = packet.payload(table);
        if (value === null) {
            throw new V4DecodeError(`missing payload for message type ${type}`);
        }
        return value;
    };
    switch (type) {
        case v4_1.Message.Load: {
            const load = payload(new v4_1.Load());
            switch (load.sourceType()) {
                case v4_1.MediaSource.Single:
                    return { type: 'load', play: playMessageFromV4(load.source(new v4_1.MediaItem())) };
                case v4_1.MediaSource.Queue:
                    return { type: 'load', play: playMessageFromV4Queue(load.source(new v4_1.Queue())) };
                default:
                    throw new V4DecodeError(`invalid media source ${load.sourceType()}`);
            }
        }
        case v4_1.Message.ProgressChanged: {
            const position = timeToSeconds(payload(new v4_1.ProgressChanged()).position());
            if (position === null) {
                throw new V4DecodeError('ProgressChanged without position');
            }
            return { type: 'seek', time: position };
        }
        case v4_1.Message.VolumeChanged:
            return { type: 'volume', volume: payload(new v4_1.VolumeChanged()).volume() };
        case v4_1.Message.SpeedChanged:
            return { type: 'speed', speed: payload(new v4_1.SpeedChanged()).speed() };
        case v4_1.Message.PlaybackStateChanged:
            return { type: 'playbackState', state: payload(new v4_1.PlaybackStateChanged()).state() };
        case v4_1.Message.StopPlayback:
            return { type: 'stop' };
        case v4_1.Message.QueueItemSelected: {
            const msg = payload(new v4_1.QueueItemSelected());
            return { type: 'queueItemSelected', position: queuePositionFromV4(msg.positionType(), () => msg.position(new v4_1.QueueIndex())) };
        }
        case v4_1.Message.QueueInsert: {
            const msg = payload(new v4_1.QueueInsert());
            const item = msg.item();
            if (item === null) {
                throw new V4DecodeError('missing required field item');
            }
            return {
                type: 'queueInsert',
                item: mediaItemFromV4(item),
                position: queuePositionFromV4(msg.positionType(), () => msg.position(new v4_1.QueueIndex())),
            };
        }
        case v4_1.Message.QueueRemove: {
            const msg = payload(new v4_1.QueueRemove());
            return { type: 'queueRemove', position: queuePositionFromV4(msg.positionType(), () => msg.position(new v4_1.QueueIndex())) };
        }
        case v4_1.Message.ChangeTrack: {
            const msg = payload(new v4_1.ChangeTrack());
            return { type: 'changeTrack', trackType: trackTypeFromV4(msg.trackType()), id: msg.id() };
        }
        case v4_1.Message.AddSubtitleSource: {
            const msg = payload(new v4_1.AddSubtitleSource());
            const url = requiredString(msg.url(), 'url');
            if (url.length === 0) {
                // The spec gives an empty URL no meaning.
                throw new V4DecodeError('empty subtitle URL');
            }
            return { type: 'addSubtitleSource', url: url, select: msg.select(), name: msg.name() };
        }
        case v4_1.Message.SenderIntroduction: {
            const info = payload(new v4_1.SenderIntroduction()).deviceInfo();
            return {
                type: 'senderIntroduction',
                deviceInfo: {
                    displayName: info ? info.displayName() : null,
                    appName: info ? info.appName() : null,
                    appVersion: info ? info.appVersion() : null,
                },
            };
        }
        case v4_1.Message.SetProgressUpdateInterval: {
            const interval = timeToSeconds(payload(new v4_1.SetProgressUpdateInterval()).interval());
            if (interval === null) {
                throw new V4DecodeError('SetProgressUpdateInterval without interval');
            }
            return { type: 'progressUpdateInterval', intervalMs: interval * 1000 };
        }
        case v4_1.Message.StartMirroringSession:
            return { type: 'startMirroringSession', sessionId: payload(new v4_1.StartMirroringSession()).sessionId() };
        case v4_1.Message.MirroringSessionDescription: {
            const msg = payload(new v4_1.MirroringSessionDescription());
            return { type: 'mirroringSessionDescription', sessionId: msg.sessionId(), sdp: requiredString(msg.sdp(), 'sdp') };
        }
        case v4_1.Message.CompanionHelloRequest:
            payload(new v4_1.CompanionHelloRequest());
            return { type: 'companionHelloRequest' };
        case v4_1.Message.CompanionResourceInfoResponse: {
            const msg = payload(new v4_1.CompanionResourceInfoResponse());
            let size = null;
            if (msg.resourceSizeType() === v4_1.CompanionResourceSize.Known) {
                size = Number(msg.resourceSize(new v4_1.KnownResourceSize()).size());
            }
            return {
                type: 'companionResourceInfoResponse',
                requestId: msg.requestId(),
                contentType: requiredString(msg.contentType(), 'content_type'),
                size: size,
            };
        }
        default:
            return { type: 'unsupported', message: type };
    }
}
function parseResourcePacket(body) {
    if (body.length < RESOURCE_HEADER_SIZE) {
        throw new V4DecodeError('Resource packet too short');
    }
    const tag = body[6];
    if (tag !== 0 && tag !== 1) {
        throw new V4DecodeError(`invalid resource result ${tag}`);
    }
    return {
        requestId: body.readUInt32LE(0),
        part: body[4],
        totalParts: body[5],
        found: tag === 1,
        data: body.subarray(RESOURCE_HEADER_SIZE),
    };
}
function encodeResourcePacket(requestId, part, totalParts, data) {
    const header = Buffer.alloc(RESOURCE_HEADER_SIZE);
    header.writeUInt32LE(requestId, 0);
    header[4] = part;
    header[5] = totalParts;
    header[6] = data === null ? 0 : 1;
    return data === null ? header : Buffer.concat([header, data]);
}
// ---- Encoding --------------------------------------------------------------------------------
function createString(builder, value) {
    return value !== null && value !== undefined ? builder.createString(value) : 0;
}
function createStringVector(builder, values) {
    const offsets = values.map((value) => builder.createString(value));
    builder.startVector(4, offsets.length, 4);
    for (let i = offsets.length - 1; i >= 0; i--) {
        builder.addOffset(offsets[i]);
    }
    return builder.endVector();
}
function createQueuePosition(builder, position) {
    switch (position.kind) {
        case 'index':
            return [v4_1.QueuePosition.Index, v4_1.QueueIndex.createQueueIndex(builder, position.index)];
        case 'front':
            v4_1.QueueMarkerFront.startQueueMarkerFront(builder);
            return [v4_1.QueuePosition.Front, v4_1.QueueMarkerFront.endQueueMarkerFront(builder)];
        case 'back':
            v4_1.QueueMarkerBack.startQueueMarkerBack(builder);
            return [v4_1.QueuePosition.Back, v4_1.QueueMarkerBack.endQueueMarkerBack(builder)];
    }
}
function createDeviceInfo(builder, info) {
    return v4_1.DeviceInfo.createDeviceInfo(builder, createString(builder, info.displayName), createString(builder, info.appName), createString(builder, info.appVersion));
}
function encodeReceiverIntroduction(info, media, volumeStepInterval) {
    const builder = new flatbuffers.Builder(1024);
    const deviceInfo = createDeviceInfo(builder, info);
    const mediaCapabilities = v4_1.MediaCapabilities.createMediaCapabilities(builder, createStringVector(builder, media.protocols), createStringVector(builder, media.containers), createStringVector(builder, media.videoFormats), createStringVector(builder, media.audioFormats), createStringVector(builder, media.subtitleFormats), createStringVector(builder, media.hdrFormats), createStringVector(builder, media.imageFormats), media.externalSubtitles, media.mirroring);
    const audioCapabilities = v4_1.AudioCapabilities.createAudioCapabilities(builder, volumeStepInterval);
    v4_1.ReceiverCapabilities.startReceiverCapabilities(builder);
    v4_1.ReceiverCapabilities.addMedia(builder, mediaCapabilities);
    v4_1.ReceiverCapabilities.addAudio(builder, audioCapabilities);
    const capabilities = v4_1.ReceiverCapabilities.endReceiverCapabilities(builder);
    v4_1.ReceiverIntroduction.startReceiverIntroduction(builder);
    v4_1.ReceiverIntroduction.addDeviceInfo(builder, deviceInfo);
    v4_1.ReceiverIntroduction.addCapabilities(builder, capabilities);
    return finish(builder, v4_1.Message.ReceiverIntroduction, v4_1.ReceiverIntroduction.endReceiverIntroduction(builder));
}
function encodeVolumeChanged(volume) {
    const builder = new flatbuffers.Builder(64);
    return finish(builder, v4_1.Message.VolumeChanged, v4_1.VolumeChanged.createVolumeChanged(builder, volume));
}
function encodeSpeedChanged(speed) {
    const builder = new flatbuffers.Builder(64);
    return finish(builder, v4_1.Message.SpeedChanged, v4_1.SpeedChanged.createSpeedChanged(builder, speed));
}
function encodePlaybackStateChanged(state) {
    const builder = new flatbuffers.Builder(64);
    return finish(builder, v4_1.Message.PlaybackStateChanged, v4_1.PlaybackStateChanged.createPlaybackStateChanged(builder, state));
}
// `duration` is omitted when unknown (null, NaN or infinite, e.g. livestreams). Sender-side this
// is a seek request.
function encodeProgressChanged(position, duration) {
    const builder = new flatbuffers.Builder(64);
    v4_1.ProgressChanged.startProgressChanged(builder);
    v4_1.ProgressChanged.addPosition(builder, v4_1.Time.createTime(builder, secondsToMicros(position)));
    if (duration !== null && isFinite(duration)) {
        v4_1.ProgressChanged.addDuration(builder, v4_1.Time.createTime(builder, secondsToMicros(duration)));
    }
    return finish(builder, v4_1.Message.ProgressChanged, v4_1.ProgressChanged.endProgressChanged(builder));
}
function encodeQueueItemSelected(position) {
    const builder = new flatbuffers.Builder(64);
    const [type, offset] = createQueuePosition(builder, typeof position === 'number' ? { kind: 'index', index: position } : position);
    return finish(builder, v4_1.Message.QueueItemSelected, v4_1.QueueItemSelected.createQueueItemSelected(builder, type, offset));
}
function encodeQueueRemove(position) {
    const builder = new flatbuffers.Builder(64);
    const [type, offset] = createQueuePosition(builder, position);
    return finish(builder, v4_1.Message.QueueRemove, v4_1.QueueRemove.createQueueRemove(builder, type, offset));
}
function encodeStopPlayback() {
    const builder = new flatbuffers.Builder(64);
    v4_1.StopPlayback.startStopPlayback(builder);
    return finish(builder, v4_1.Message.StopPlayback, v4_1.StopPlayback.endStopPlayback(builder));
}
function encodeError(kind, packetNum) {
    const builder = new flatbuffers.Builder(64);
    return finish(builder, v4_1.Message.Error, v4_1.Error.createError(builder, kind, packetNum));
}
function encodeTracksAvailable(tracks) {
    const builder = new flatbuffers.Builder(1024);
    const offsets = tracks.map((track) => {
        const language = builder.createString(track.language || 'und');
        const title = createString(builder, track.title);
        let metadataType;
        let metadata;
        switch (track.type) {
            case 'video':
                metadataType = v4_1.MediaTrackMetadata.Video;
                v4_1.VideoTrackMeta.startVideoTrackMeta(builder);
                if (track.width && track.height) {
                    v4_1.VideoTrackMeta.addResolution(builder, v4_1.VideoResolution.createVideoResolution(builder, track.width, track.height));
                }
                metadata = v4_1.VideoTrackMeta.endVideoTrackMeta(builder);
                break;
            case 'audio':
                metadataType = v4_1.MediaTrackMetadata.Audio;
                v4_1.AudioTrackMeta.startAudioTrackMeta(builder);
                metadata = v4_1.AudioTrackMeta.endAudioTrackMeta(builder);
                break;
            case 'subtitle':
                metadataType = v4_1.MediaTrackMetadata.Subtitle;
                metadata = v4_1.SubtitleTrackMeta.createSubtitleTrackMeta(builder);
                break;
        }
        return v4_1.MediaTrack.createMediaTrack(builder, track.id, language, title, metadataType, metadata);
    });
    const list = v4_1.TracksAvailable.createTracksVector(builder, offsets);
    return finish(builder, v4_1.Message.TracksAvailable, v4_1.TracksAvailable.createTracksAvailable(builder, list));
}
// `id` null means the track type is off (e.g. no subtitles).
function encodeChangeTrack(id, type) {
    const builder = new flatbuffers.Builder(64);
    return finish(builder, v4_1.Message.ChangeTrack, v4_1.ChangeTrack.createChangeTrack(builder, id, TRACK_TYPES[type]));
}
function encodeCompanionHelloResponse(providerId) {
    const builder = new flatbuffers.Builder(64);
    return finish(builder, v4_1.Message.CompanionHelloResponse, v4_1.CompanionHelloResponse.createCompanionHelloResponse(builder, providerId));
}
function encodeCompanionResourceInfoRequest(requestId, resourceId) {
    const builder = new flatbuffers.Builder(64);
    return finish(builder, v4_1.Message.CompanionResourceInfoRequest, v4_1.CompanionResourceInfoRequest.createCompanionResourceInfoRequest(builder, requestId, resourceId));
}
function encodeCompanionResourceRequest(requestId, resourceId, start, stopInclusive) {
    const builder = new flatbuffers.Builder(64);
    v4_1.CompanionResourceRequest.startCompanionResourceRequest(builder);
    v4_1.CompanionResourceRequest.addRequestId(builder, requestId);
    v4_1.CompanionResourceRequest.addResourceId(builder, resourceId);
    v4_1.CompanionResourceRequest.addReadHead(builder, v4_1.ResourceReadHead.createResourceReadHead(builder, BigInt(start), BigInt(stopInclusive)));
    return finish(builder, v4_1.Message.CompanionResourceRequest, v4_1.CompanionResourceRequest.endCompanionResourceRequest(builder));
}
function encodeMirroringSessionDescription(sessionId, sdp) {
    const builder = new flatbuffers.Builder(1024);
    const sdpOffset = builder.createString(sdp);
    return finish(builder, v4_1.Message.MirroringSessionDescription, v4_1.MirroringSessionDescription.createMirroringSessionDescription(builder, sessionId, sdpOffset));
}
function createMediaItem(builder, item, includeHeaders) {
    // v4 items always carry a URL. Inline v2/v3 content (e.g. a DASH manifest) becomes a data URL.
    const url = item.url !== null && item.url !== undefined ? item.url :
        `data:${item.container};base64,${Buffer.from(item.content !== null && item.content !== undefined ? item.content : '', 'utf8').toString('base64')}`;
    const container = builder.createString(item.container);
    const sourceUrl = builder.createString(url);
    const metadata = (item.metadata ? item.metadata : {});
    const title = typeof metadata.title === 'string' ? builder.createString(metadata.title) : 0;
    const thumbnailUrl = typeof metadata.thumbnailUrl === 'string' ? builder.createString(metadata.thumbnailUrl) : 0;
    let headers = 0;
    if (includeHeaders && item.headers) {
        const headerOffsets = Object.keys(item.headers).map((key) => v4_1.RequestHeader.createRequestHeader(builder, builder.createString(key), builder.createString(item.headers[key])));
        headers = v4_1.MediaItem.createHeadersVector(builder, headerOffsets);
    }
    v4_1.MediaItem.startMediaItem(builder);
    v4_1.MediaItem.addContainer(builder, container);
    v4_1.MediaItem.addSourceUrl(builder, sourceUrl);
    if (item.time !== null && item.time !== undefined) {
        v4_1.MediaItem.addStartTime(builder, v4_1.Time.createTime(builder, secondsToMicros(item.time)));
    }
    if (item.volume !== null && item.volume !== undefined) {
        v4_1.MediaItem.addVolume(builder, item.volume);
    }
    if (item.speed !== null && item.speed !== undefined) {
        v4_1.MediaItem.addSpeed(builder, item.speed);
    }
    if (headers) {
        v4_1.MediaItem.addHeaders(builder, headers);
    }
    if (title) {
        v4_1.MediaItem.addTitle(builder, title);
    }
    if (thumbnailUrl) {
        v4_1.MediaItem.addThumbnailUrl(builder, thumbnailUrl);
    }
    return v4_1.MediaItem.endMediaItem(builder);
}
function createQueueItem(builder, item, includeHeaders) {
    const mediaItem = createMediaItem(builder, item, includeHeaders);
    v4_1.QueueItem.startQueueItem(builder);
    v4_1.QueueItem.addMediaItem(builder, mediaItem);
    if (item.showDuration !== null && item.showDuration !== undefined) {
        v4_1.QueueItem.addPlaybackDuration(builder, v4_1.Time.createTime(builder, secondsToMicros(item.showDuration)));
    }
    return v4_1.QueueItem.endQueueItem(builder);
}
function parsePlaylist(message) {
    if (!message || message.container !== exports.PLAYLIST_CONTAINER || !message.content) {
        return null;
    }
    try {
        const content = JSON.parse(message.content);
        return content && content.contentType === Packets_1.ContentType.Playlist && Array.isArray(content.items) ? content : null;
    }
    catch (_a) {
        return null;
    }
}
function loadSourceOf(message) {
    const playlist = parsePlaylist(message);
    if (playlist === null) {
        return { kind: 'single', message: message };
    }
    return {
        kind: 'queue',
        items: playlist.items,
        index: playlist.offset !== null && playlist.offset !== undefined ? playlist.offset : 0,
        // v3 playlists always advance.
        autoplay: playlist.autoplay !== undefined ? playlist.autoplay : true,
    };
}
// Encodes a v4 `Load`. Request headers are left out by default: the spec strips them when relaying
// a load to other senders so credentials aren't shared.
function encodeLoadSource(source, includeHeaders = false) {
    const builder = new flatbuffers.Builder(1024);
    let load;
    if (source.kind === 'queue') {
        const items = source.items.map((item) => createQueueItem(builder, item, includeHeaders));
        const queue = v4_1.Queue.createQueue(builder, v4_1.Queue.createItemsVector(builder, items), source.index, source.autoplay);
        load = v4_1.Load.createLoad(builder, v4_1.MediaSource.Queue, queue);
    }
    else {
        load = v4_1.Load.createLoad(builder, v4_1.MediaSource.Single, createMediaItem(builder, source.message, includeHeaders));
    }
    return finish(builder, v4_1.Message.Load, load);
}
function encodeLoad(message, includeHeaders = false) {
    return encodeLoadSource(loadSourceOf(message), includeHeaders);
}
function encodeQueueInsert(item, position, includeHeaders = false) {
    const builder = new flatbuffers.Builder(1024);
    const queueItem = createQueueItem(builder, item, includeHeaders);
    const [type, offset] = createQueuePosition(builder, position);
    return finish(builder, v4_1.Message.QueueInsert, v4_1.QueueInsert.createQueueInsert(builder, queueItem, type, offset));
}
// ---- Sender-side encoders (tests and tools) ---------------------------------------------------
function encodeSenderIntroduction(info) {
    const builder = new flatbuffers.Builder(256);
    const deviceInfo = createDeviceInfo(builder, info);
    return finish(builder, v4_1.Message.SenderIntroduction, v4_1.SenderIntroduction.createSenderIntroduction(builder, deviceInfo));
}
function encodeAddSubtitleSource(url, select, name) {
    const builder = new flatbuffers.Builder(256);
    const urlOffset = builder.createString(url);
    const nameOffset = createString(builder, name);
    v4_1.AddSubtitleSource.startAddSubtitleSource(builder);
    v4_1.AddSubtitleSource.addUrl(builder, urlOffset);
    v4_1.AddSubtitleSource.addSelect(builder, select);
    if (nameOffset) {
        v4_1.AddSubtitleSource.addName(builder, nameOffset);
    }
    return finish(builder, v4_1.Message.AddSubtitleSource, v4_1.AddSubtitleSource.endAddSubtitleSource(builder));
}
function encodeSetProgressUpdateInterval(intervalMs) {
    const builder = new flatbuffers.Builder(64);
    v4_1.SetProgressUpdateInterval.startSetProgressUpdateInterval(builder);
    v4_1.SetProgressUpdateInterval.addInterval(builder, v4_1.Time.createTime(builder, secondsToMicros(intervalMs / 1000)));
    return finish(builder, v4_1.Message.SetProgressUpdateInterval, v4_1.SetProgressUpdateInterval.endSetProgressUpdateInterval(builder));
}
function encodeStartMirroringSession(sessionId) {
    const builder = new flatbuffers.Builder(64);
    return finish(builder, v4_1.Message.StartMirroringSession, v4_1.StartMirroringSession.createStartMirroringSession(builder, sessionId));
}
function encodeCompanionHelloRequest() {
    const builder = new flatbuffers.Builder(64);
    v4_1.CompanionHelloRequest.startCompanionHelloRequest(builder);
    return finish(builder, v4_1.Message.CompanionHelloRequest, v4_1.CompanionHelloRequest.endCompanionHelloRequest(builder));
}
function encodeCompanionResourceInfoResponse(requestId, contentType, size) {
    const builder = new flatbuffers.Builder(256);
    const contentTypeOffset = builder.createString(contentType);
    let sizeType;
    let sizeOffset;
    if (size === null) {
        sizeType = v4_1.CompanionResourceSize.Unknown;
        v4_1.UnknownResourceSize.startUnknownResourceSize(builder);
        sizeOffset = v4_1.UnknownResourceSize.endUnknownResourceSize(builder);
    }
    else {
        sizeType = v4_1.CompanionResourceSize.Known;
        sizeOffset = v4_1.KnownResourceSize.createKnownResourceSize(builder, BigInt(size));
    }
    return finish(builder, v4_1.Message.CompanionResourceInfoResponse, v4_1.CompanionResourceInfoResponse.createCompanionResourceInfoResponse(builder, requestId, contentTypeOffset, sizeType, sizeOffset));
}


/***/ }),

/***/ 3463:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.QueueRemove = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const queue_position_1 = __webpack_require__(7548);
class QueueRemove {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsQueueRemove(bb, obj) {
        return (obj || new QueueRemove()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsQueueRemove(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new QueueRemove()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    positionType() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readUint8(this.bb_pos + offset) : queue_position_1.QueuePosition.NONE;
    }
    position(obj) {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.__union(obj, this.bb_pos + offset) : null;
    }
    static startQueueRemove(builder) {
        builder.startObject(2);
    }
    static addPositionType(builder, positionType) {
        builder.addFieldInt8(0, positionType, queue_position_1.QueuePosition.NONE);
    }
    static addPosition(builder, positionOffset) {
        builder.addFieldOffset(1, positionOffset, 0);
    }
    static endQueueRemove(builder) {
        const offset = builder.endObject();
        builder.requiredField(offset, 6); // position
        return offset;
    }
    static createQueueRemove(builder, positionType, positionOffset) {
        QueueRemove.startQueueRemove(builder);
        QueueRemove.addPositionType(builder, positionType);
        QueueRemove.addPosition(builder, positionOffset);
        return QueueRemove.endQueueRemove(builder);
    }
}
exports.QueueRemove = QueueRemove;


/***/ }),

/***/ 3530:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.NetworkService = void 0;
const MimeTypes_1 = __webpack_require__(8778);
const MediaCache_1 = __webpack_require__(529);
const follow_redirects_1 = __webpack_require__(3640);
const url = __importStar(__webpack_require__(7016));
const uuid_1 = __webpack_require__(206);
const Logger_1 = __webpack_require__(1943);
const logger = new Logger_1.Logger('NetworkService', Logger_1.LoggerType.BACKEND);
class NetworkService {
    static setupProxyServer() {
        return new Promise((resolve, reject) => {
            try {
                logger.info(`Proxy server starting`);
                const port = 0;
                NetworkService.proxyServer = follow_redirects_1.http.createServer((req, res) => {
                    logger.info(`Request received`);
                    const requestUrl = `http://${req.headers.host}${req.url}`;
                    const proxyInfo = NetworkService.proxiedFiles.get(requestUrl);
                    if (!proxyInfo) {
                        res.writeHead(404);
                        res.end('Not found');
                        return;
                    }
                    if (proxyInfo.url.startsWith('app://')) {
                        let start = 0;
                        let end = null;
                        const contentSize = MediaCache_1.MediaCache.getInstance().getObjectSize(proxyInfo.url);
                        if (req.headers.range) {
                            const range = req.headers.range.slice(6).split('-');
                            start = (range.length > 0) ? parseInt(range[0]) : 0;
                            end = (range.length > 1) ? parseInt(range[1]) : null;
                        }
                        logger.debug(`Fetching byte range from cache: start=${start}, end=${end}`);
                        const stream = MediaCache_1.MediaCache.getInstance().getObject(proxyInfo.url, start, end);
                        let responseCode = null;
                        let responseHeaders = null;
                        if (start != 0) {
                            responseCode = 206;
                            responseHeaders = {
                                'Accept-Ranges': 'bytes',
                                'Content-Length': contentSize - start,
                                'Content-Range': `bytes ${start}-${end ? end : contentSize - 1}/${contentSize}`,
                                'Content-Type': proxyInfo.container,
                            };
                        }
                        else {
                            responseCode = 200;
                            responseHeaders = {
                                'Accept-Ranges': 'bytes',
                                'Content-Length': contentSize,
                                'Content-Type': proxyInfo.container,
                            };
                        }
                        logger.debug(`Serving content ${proxyInfo.url} with response headers:`, responseHeaders);
                        res.writeHead(responseCode, responseHeaders);
                        stream.pipe(res);
                    }
                    else {
                        const omitHeaders = new Set([
                            'host',
                            'connection',
                            'keep-alive',
                            'proxy-authenticate',
                            'proxy-authorization',
                            'te',
                            'trailers',
                            'transfer-encoding',
                            'upgrade'
                        ]);
                        const filteredHeaders = Object.fromEntries(Object.entries(req.headers)
                            .filter(([key]) => !omitHeaders.has(key.toLowerCase()))
                            .map(([key, value]) => [key, Array.isArray(value) ? value.join(', ') : value]));
                        const protocol = proxyInfo.url.startsWith('https') ? follow_redirects_1.https : follow_redirects_1.http;
                        const parsedUrl = url.parse(proxyInfo.url);
                        const options = {
                            ...parsedUrl,
                            method: req.method,
                            headers: { ...filteredHeaders, ...proxyInfo.headers }
                        };
                        const proxyReq = protocol.request(options, (proxyRes) => {
                            res.writeHead(proxyRes.statusCode, proxyRes.headers);
                            proxyRes.pipe(res, { end: true });
                        });
                        req.pipe(proxyReq, { end: true });
                        proxyReq.on('error', (e) => {
                            logger.error(`Problem with request: ${e.message}`);
                            res.writeHead(500);
                            res.end();
                        });
                    }
                });
                NetworkService.proxyServer.on('error', e => {
                    reject(e);
                });
                NetworkService.proxyServer.listen(port, '127.0.0.1', () => {
                    NetworkService.proxyServerAddress = NetworkService.proxyServer.address();
                    logger.info(`Proxy server running at http://127.0.0.1:${NetworkService.proxyServerAddress.port}/`);
                    resolve();
                });
            }
            catch (e) {
                reject(e);
            }
        });
    }
    static async proxyPlayIfRequired(message) {
        if (message.url && (message.url.startsWith('app://') || (message.headers && !MimeTypes_1.streamingMediaTypes.find(v => v === message.container.toLocaleLowerCase())))) {
            return await NetworkService.proxyFile(message);
        }
        return null;
    }
    static async proxyFile(message) {
        if (!NetworkService.proxyServer) {
            await NetworkService.setupProxyServer();
        }
        const proxiedUrl = `http://127.0.0.1:${NetworkService.proxyServerAddress.port}/${(0, uuid_1.v4)()}`;
        logger.info("Proxied url", { proxiedUrl, message });
        NetworkService.proxiedFiles.set(proxiedUrl, message);
        return proxiedUrl;
    }
}
exports.NetworkService = NetworkService;
NetworkService.key = null;
NetworkService.cert = null;
NetworkService.proxiedFiles = new Map();


/***/ }),

/***/ 3640:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var url = __webpack_require__(7016);
var URL = url.URL;
var http = __webpack_require__(8611);
var https = __webpack_require__(5692);
var Writable = (__webpack_require__(2203).Writable);
var assert = __webpack_require__(2613);
var debug = __webpack_require__(2887);
// Preventive platform detection
// istanbul ignore next
(function detectUnsupportedEnvironment() {
    var looksLikeNode = typeof process !== "undefined";
    var looksLikeBrowser = typeof window !== "undefined" && typeof document !== "undefined";
    var looksLikeV8 = isFunction(Error.captureStackTrace);
    if (!looksLikeNode && (looksLikeBrowser || !looksLikeV8)) {
        console.warn("The follow-redirects package should be excluded from browser builds.");
    }
}());
// Whether to use the native URL object or the legacy url module
var useNativeURL = false;
try {
    assert(new URL(""));
}
catch (error) {
    useNativeURL = error.code === "ERR_INVALID_URL";
}
// HTTP headers to drop across HTTP/HTTPS and domain boundaries
var sensitiveHeaders = [
    "Authorization",
    "Proxy-Authorization",
    "Cookie",
];
// URL fields to preserve in copy operations
var preservedUrlFields = [
    "auth",
    "host",
    "hostname",
    "href",
    "path",
    "pathname",
    "port",
    "protocol",
    "query",
    "search",
    "hash",
];
// Create handlers that pass events from native requests
var events = ["abort", "aborted", "connect", "error", "socket", "timeout"];
var eventHandlers = Object.create(null);
events.forEach(function (event) {
    eventHandlers[event] = function (arg1, arg2, arg3) {
        this._redirectable.emit(event, arg1, arg2, arg3);
    };
});
// Error types with codes
var InvalidUrlError = createErrorType("ERR_INVALID_URL", "Invalid URL", TypeError);
var RedirectionError = createErrorType("ERR_FR_REDIRECTION_FAILURE", "Redirected request failed");
var TooManyRedirectsError = createErrorType("ERR_FR_TOO_MANY_REDIRECTS", "Maximum number of redirects exceeded", RedirectionError);
var MaxBodyLengthExceededError = createErrorType("ERR_FR_MAX_BODY_LENGTH_EXCEEDED", "Request body larger than maxBodyLength limit");
var WriteAfterEndError = createErrorType("ERR_STREAM_WRITE_AFTER_END", "write after end");
// istanbul ignore next
var destroy = Writable.prototype.destroy || noop;
// An HTTP(S) request that can be redirected
function RedirectableRequest(options, responseCallback) {
    // Initialize the request
    Writable.call(this);
    this._sanitizeOptions(options);
    this._options = options;
    this._ended = false;
    this._ending = false;
    this._redirectCount = 0;
    this._redirects = [];
    this._requestBodyLength = 0;
    this._requestBodyBuffers = [];
    // Attach a callback if passed
    if (responseCallback) {
        this.on("response", responseCallback);
    }
    // React to responses of native requests
    var self = this;
    this._onNativeResponse = function (response) {
        try {
            self._processResponse(response);
        }
        catch (cause) {
            self.emit("error", cause instanceof RedirectionError ?
                cause : new RedirectionError({ cause: cause }));
        }
    };
    // Create filter for sensitive HTTP headers
    this._headerFilter = new RegExp("^(?:" +
        sensitiveHeaders.concat(options.sensitiveHeaders).map(escapeRegex).join("|") +
        ")$", "i");
    // Perform the first request
    this._performRequest();
}
RedirectableRequest.prototype = Object.create(Writable.prototype);
RedirectableRequest.prototype.abort = function () {
    destroyRequest(this._currentRequest);
    this._currentRequest.abort();
    this.emit("abort");
};
RedirectableRequest.prototype.destroy = function (error) {
    destroyRequest(this._currentRequest, error);
    destroy.call(this, error);
    return this;
};
// Writes buffered data to the current native request
RedirectableRequest.prototype.write = function (data, encoding, callback) {
    // Writing is not allowed if end has been called
    if (this._ending) {
        throw new WriteAfterEndError();
    }
    // Validate input and shift parameters if necessary
    if (!isString(data) && !isBuffer(data)) {
        throw new TypeError("data should be a string, Buffer or Uint8Array");
    }
    if (isFunction(encoding)) {
        callback = encoding;
        encoding = null;
    }
    // Ignore empty buffers, since writing them doesn't invoke the callback
    // https://github.com/nodejs/node/issues/22066
    if (data.length === 0) {
        if (callback) {
            callback();
        }
        return;
    }
    // Only write when we don't exceed the maximum body length
    if (this._requestBodyLength + data.length <= this._options.maxBodyLength) {
        this._requestBodyLength += data.length;
        this._requestBodyBuffers.push({ data: data, encoding: encoding });
        this._currentRequest.write(data, encoding, callback);
    }
    // Error when we exceed the maximum body length
    else {
        this.emit("error", new MaxBodyLengthExceededError());
        this.abort();
    }
};
// Ends the current native request
RedirectableRequest.prototype.end = function (data, encoding, callback) {
    // Shift parameters if necessary
    if (isFunction(data)) {
        callback = data;
        data = encoding = null;
    }
    else if (isFunction(encoding)) {
        callback = encoding;
        encoding = null;
    }
    // Write data if needed and end
    if (!data) {
        this._ended = this._ending = true;
        this._currentRequest.end(null, null, callback);
    }
    else {
        var self = this;
        var currentRequest = this._currentRequest;
        this.write(data, encoding, function () {
            self._ended = true;
            currentRequest.end(null, null, callback);
        });
        this._ending = true;
    }
};
// Sets a header value on the current native request
RedirectableRequest.prototype.setHeader = function (name, value) {
    this._options.headers[name] = value;
    this._currentRequest.setHeader(name, value);
};
// Clears a header value on the current native request
RedirectableRequest.prototype.removeHeader = function (name) {
    delete this._options.headers[name];
    this._currentRequest.removeHeader(name);
};
// Global timeout for all underlying requests
RedirectableRequest.prototype.setTimeout = function (msecs, callback) {
    var self = this;
    // Destroys the socket on timeout
    function destroyOnTimeout(socket) {
        socket.setTimeout(msecs);
        socket.removeListener("timeout", socket.destroy);
        socket.addListener("timeout", socket.destroy);
    }
    // Sets up a timer to trigger a timeout event
    function startTimer(socket) {
        if (self._timeout) {
            clearTimeout(self._timeout);
        }
        self._timeout = setTimeout(function () {
            self.emit("timeout");
            clearTimer();
        }, msecs);
        destroyOnTimeout(socket);
    }
    // Stops a timeout from triggering
    function clearTimer() {
        // Clear the timeout
        if (self._timeout) {
            clearTimeout(self._timeout);
            self._timeout = null;
        }
        // Clean up all attached listeners
        self.removeListener("abort", clearTimer);
        self.removeListener("error", clearTimer);
        self.removeListener("response", clearTimer);
        self.removeListener("close", clearTimer);
        if (callback) {
            self.removeListener("timeout", callback);
        }
        if (!self.socket) {
            self._currentRequest.removeListener("socket", startTimer);
        }
    }
    // Attach callback if passed
    if (callback) {
        this.on("timeout", callback);
    }
    // Start the timer if or when the socket is opened
    if (this.socket) {
        startTimer(this.socket);
    }
    else {
        this._currentRequest.once("socket", startTimer);
    }
    // Clean up on events
    this.on("socket", destroyOnTimeout);
    this.on("abort", clearTimer);
    this.on("error", clearTimer);
    this.on("response", clearTimer);
    this.on("close", clearTimer);
    return this;
};
// Proxy all other public ClientRequest methods
[
    "flushHeaders", "getHeader",
    "setNoDelay", "setSocketKeepAlive",
].forEach(function (method) {
    RedirectableRequest.prototype[method] = function (a, b) {
        return this._currentRequest[method](a, b);
    };
});
// Proxy all public ClientRequest properties
["aborted", "connection", "socket"].forEach(function (property) {
    Object.defineProperty(RedirectableRequest.prototype, property, {
        get: function () { return this._currentRequest[property]; },
    });
});
RedirectableRequest.prototype._sanitizeOptions = function (options) {
    // Ensure headers are always present
    if (!options.headers) {
        options.headers = {};
    }
    if (!isArray(options.sensitiveHeaders)) {
        options.sensitiveHeaders = [];
    }
    // Since http.request treats host as an alias of hostname,
    // but the url module interprets host as hostname plus port,
    // eliminate the host property to avoid confusion.
    if (options.host) {
        // Use hostname if set, because it has precedence
        if (!options.hostname) {
            options.hostname = options.host;
        }
        delete options.host;
    }
    // Complete the URL object when necessary
    if (!options.pathname && options.path) {
        var searchPos = options.path.indexOf("?");
        if (searchPos < 0) {
            options.pathname = options.path;
        }
        else {
            options.pathname = options.path.substring(0, searchPos);
            options.search = options.path.substring(searchPos);
        }
    }
};
// Executes the next native request (initial or redirect)
RedirectableRequest.prototype._performRequest = function () {
    // Load the native protocol
    var protocol = this._options.protocol;
    var nativeProtocol = this._options.nativeProtocols[protocol];
    if (!nativeProtocol) {
        throw new TypeError("Unsupported protocol " + protocol);
    }
    // If specified, use the agent corresponding to the protocol
    // (HTTP and HTTPS use different types of agents)
    if (this._options.agents) {
        var scheme = protocol.slice(0, -1);
        this._options.agent = this._options.agents[scheme];
    }
    // Create the native request and set up its event handlers
    var request = this._currentRequest =
        nativeProtocol.request(this._options, this._onNativeResponse);
    request._redirectable = this;
    for (var event of events) {
        request.on(event, eventHandlers[event]);
    }
    // RFC7230§5.3.1: When making a request directly to an origin server, […]
    // a client MUST send only the absolute path […] as the request-target.
    this._currentUrl = /^\//.test(this._options.path) ?
        url.format(this._options) :
        // When making a request to a proxy, […]
        // a client MUST send the target URI in absolute-form […].
        this._options.path;
    // End a redirected request
    // (The first request must be ended explicitly with RedirectableRequest#end)
    if (this._isRedirect) {
        // Write the request entity and end
        var i = 0;
        var self = this;
        var buffers = this._requestBodyBuffers;
        (function writeNext(error) {
            // Only write if this request has not been redirected yet
            // istanbul ignore else
            if (request === self._currentRequest) {
                // Report any write errors
                // istanbul ignore if
                if (error) {
                    self.emit("error", error);
                }
                // Write the next buffer if there are still left
                else if (i < buffers.length) {
                    var buffer = buffers[i++];
                    // istanbul ignore else
                    if (!request.finished) {
                        request.write(buffer.data, buffer.encoding, writeNext);
                    }
                }
                // End the request if `end` has been called on us
                else if (self._ended) {
                    request.end();
                }
            }
        }());
    }
};
// Processes a response from the current native request
RedirectableRequest.prototype._processResponse = function (response) {
    // Store the redirected response
    var statusCode = response.statusCode;
    if (this._options.trackRedirects) {
        this._redirects.push({
            url: this._currentUrl,
            headers: response.headers,
            statusCode: statusCode,
        });
    }
    // RFC7231§6.4: The 3xx (Redirection) class of status code indicates
    // that further action needs to be taken by the user agent in order to
    // fulfill the request. If a Location header field is provided,
    // the user agent MAY automatically redirect its request to the URI
    // referenced by the Location field value,
    // even if the specific status code is not understood.
    // If the response is not a redirect; return it as-is
    var location = response.headers.location;
    if (!location || this._options.followRedirects === false ||
        statusCode < 300 || statusCode >= 400) {
        response.responseUrl = this._currentUrl;
        response.redirects = this._redirects;
        this.emit("response", response);
        // Clean up
        this._requestBodyBuffers = [];
        return;
    }
    // The response is a redirect, so abort the current request
    destroyRequest(this._currentRequest);
    // Discard the remainder of the response to avoid waiting for data
    response.destroy();
    // RFC7231§6.4: A client SHOULD detect and intervene
    // in cyclical redirections (i.e., "infinite" redirection loops).
    if (++this._redirectCount > this._options.maxRedirects) {
        throw new TooManyRedirectsError();
    }
    // Store the request headers if applicable
    var requestHeaders;
    var beforeRedirect = this._options.beforeRedirect;
    if (beforeRedirect) {
        requestHeaders = Object.assign({
            // The Host header was set by nativeProtocol.request
            Host: response.req.getHeader("host"),
        }, this._options.headers);
    }
    // RFC7231§6.4: Automatic redirection needs to done with
    // care for methods not known to be safe, […]
    // RFC7231§6.4.2–3: For historical reasons, a user agent MAY change
    // the request method from POST to GET for the subsequent request.
    var method = this._options.method;
    if ((statusCode === 301 || statusCode === 302) && this._options.method === "POST" ||
        // RFC7231§6.4.4: The 303 (See Other) status code indicates that
        // the server is redirecting the user agent to a different resource […]
        // A user agent can perform a retrieval request targeting that URI
        // (a GET or HEAD request if using HTTP) […]
        (statusCode === 303) && !/^(?:GET|HEAD)$/.test(this._options.method)) {
        this._options.method = "GET";
        // Drop a possible entity and headers related to it
        this._requestBodyBuffers = [];
        removeMatchingHeaders(/^content-/i, this._options.headers);
    }
    // Drop the Host header, as the redirect might lead to a different host
    var currentHostHeader = removeMatchingHeaders(/^host$/i, this._options.headers);
    // If the redirect is relative, carry over the host of the last request
    var currentUrlParts = parseUrl(this._currentUrl);
    var currentHost = currentHostHeader || currentUrlParts.host;
    var currentUrl = /^\w+:/.test(location) ? this._currentUrl :
        url.format(Object.assign(currentUrlParts, { host: currentHost }));
    // Create the redirected request
    var redirectUrl = resolveUrl(location, currentUrl);
    debug("redirecting to", redirectUrl.href);
    this._isRedirect = true;
    spreadUrlObject(redirectUrl, this._options);
    // Drop confidential headers when redirecting to a less secure protocol
    // or to a different domain that is not a superdomain
    if (redirectUrl.protocol !== currentUrlParts.protocol &&
        redirectUrl.protocol !== "https:" ||
        redirectUrl.host !== currentHost &&
            !isSubdomain(redirectUrl.host, currentHost)) {
        removeMatchingHeaders(this._headerFilter, this._options.headers);
    }
    // Evaluate the beforeRedirect callback
    if (isFunction(beforeRedirect)) {
        var responseDetails = {
            headers: response.headers,
            statusCode: statusCode,
        };
        var requestDetails = {
            url: currentUrl,
            method: method,
            headers: requestHeaders,
        };
        beforeRedirect(this._options, responseDetails, requestDetails);
        this._sanitizeOptions(this._options);
    }
    // Perform the redirected request
    this._performRequest();
};
// Wraps the key/value object of protocols with redirect functionality
function wrap(protocols) {
    // Default settings
    var exports = {
        maxRedirects: 21,
        maxBodyLength: 10 * 1024 * 1024,
    };
    // Wrap each protocol
    var nativeProtocols = {};
    Object.keys(protocols).forEach(function (scheme) {
        var protocol = scheme + ":";
        var nativeProtocol = nativeProtocols[protocol] = protocols[scheme];
        var wrappedProtocol = exports[scheme] = Object.create(nativeProtocol);
        // Executes a request, following redirects
        function request(input, options, callback) {
            // Parse parameters, ensuring that input is an object
            if (isURL(input)) {
                input = spreadUrlObject(input);
            }
            else if (isString(input)) {
                input = spreadUrlObject(parseUrl(input));
            }
            else {
                callback = options;
                options = validateUrl(input);
                input = { protocol: protocol };
            }
            if (isFunction(options)) {
                callback = options;
                options = null;
            }
            // Set defaults
            options = Object.assign({
                maxRedirects: exports.maxRedirects,
                maxBodyLength: exports.maxBodyLength,
            }, input, options);
            options.nativeProtocols = nativeProtocols;
            if (!isString(options.host) && !isString(options.hostname)) {
                options.hostname = "::1";
            }
            assert.equal(options.protocol, protocol, "protocol mismatch");
            debug("options", options);
            return new RedirectableRequest(options, callback);
        }
        // Executes a GET request, following redirects
        function get(input, options, callback) {
            var wrappedRequest = wrappedProtocol.request(input, options, callback);
            wrappedRequest.end();
            return wrappedRequest;
        }
        // Expose the properties on the wrapped protocol
        Object.defineProperties(wrappedProtocol, {
            request: { value: request, configurable: true, enumerable: true, writable: true },
            get: { value: get, configurable: true, enumerable: true, writable: true },
        });
    });
    return exports;
}
function noop() { }
function parseUrl(input) {
    var parsed;
    // istanbul ignore else
    if (useNativeURL) {
        parsed = new URL(input);
    }
    else {
        // Ensure the URL is valid and absolute
        parsed = validateUrl(url.parse(input));
        if (!isString(parsed.protocol)) {
            throw new InvalidUrlError({ input });
        }
    }
    return parsed;
}
function resolveUrl(relative, base) {
    // istanbul ignore next
    return useNativeURL ? new URL(relative, base) : parseUrl(url.resolve(base, relative));
}
function validateUrl(input) {
    if (/^\[/.test(input.hostname) && !/^\[[:0-9a-f]+\]$/i.test(input.hostname)) {
        throw new InvalidUrlError({ input: input.href || input });
    }
    if (/^\[/.test(input.host) && !/^\[[:0-9a-f]+\](:\d+)?$/i.test(input.host)) {
        throw new InvalidUrlError({ input: input.href || input });
    }
    return input;
}
function spreadUrlObject(urlObject, target) {
    var spread = target || {};
    for (var key of preservedUrlFields) {
        spread[key] = urlObject[key];
    }
    // Fix IPv6 hostname
    if (spread.hostname.startsWith("[")) {
        spread.hostname = spread.hostname.slice(1, -1);
    }
    // Ensure port is a number
    if (spread.port !== "") {
        spread.port = Number(spread.port);
    }
    // Concatenate path
    spread.path = spread.search ? spread.pathname + spread.search : spread.pathname;
    return spread;
}
function removeMatchingHeaders(regex, headers) {
    var lastValue;
    for (var header in headers) {
        if (regex.test(header)) {
            lastValue = headers[header];
            delete headers[header];
        }
    }
    return (lastValue === null || typeof lastValue === "undefined") ?
        undefined : String(lastValue).trim();
}
function createErrorType(code, message, baseClass) {
    // Create constructor
    function CustomError(properties) {
        // istanbul ignore else
        if (isFunction(Error.captureStackTrace)) {
            Error.captureStackTrace(this, this.constructor);
        }
        Object.assign(this, properties || {});
        this.code = code;
        this.message = this.cause ? message + ": " + this.cause.message : message;
    }
    // Attach constructor and set default properties
    CustomError.prototype = new (baseClass || Error)();
    Object.defineProperties(CustomError.prototype, {
        constructor: {
            value: CustomError,
            enumerable: false,
        },
        name: {
            value: "Error [" + code + "]",
            enumerable: false,
        },
    });
    return CustomError;
}
function destroyRequest(request, error) {
    for (var event of events) {
        request.removeListener(event, eventHandlers[event]);
    }
    request.on("error", noop);
    request.destroy(error);
}
function isSubdomain(subdomain, domain) {
    assert(isString(subdomain) && isString(domain));
    var dot = subdomain.length - domain.length - 1;
    return dot > 0 && subdomain[dot] === "." && subdomain.endsWith(domain);
}
function isArray(value) {
    return value instanceof Array;
}
function isString(value) {
    return typeof value === "string" || value instanceof String;
}
function isFunction(value) {
    return typeof value === "function";
}
function isBuffer(value) {
    return typeof value === "object" && ("length" in value);
}
function isURL(value) {
    return URL && value instanceof URL;
}
function escapeRegex(regex) {
    return regex.replace(/[\]\\/()*+?.$]/g, "\\$&");
}
// Exports
module.exports = wrap({ http: http, https: https });
module.exports.wrap = wrap;


/***/ }),

/***/ 3658:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.probeUrl = probeUrl;
const url = __importStar(__webpack_require__(7016));
const follow_redirects_1 = __webpack_require__(3640);
const PROBE_TIMEOUT_MS = 5000;
// Asks for the first byte of a URL, to tell a missing resource from one the player couldn't play:
// browsers report both as the same media error.
function probeUrl(target, headers) {
    if (!/^https?:\/\//i.test(target || '')) {
        return Promise.resolve('unknown');
    }
    return new Promise((resolve) => {
        const protocol = /^https:/i.test(target) ? follow_redirects_1.https : follow_redirects_1.http;
        let done = false;
        const finish = (result) => {
            if (!done) {
                done = true;
                resolve(result);
            }
        };
        const request = protocol.get({
            ...url.parse(target),
            headers: { ...(headers || {}), Range: 'bytes=0-0' },
            timeout: PROBE_TIMEOUT_MS,
        }, (response) => {
            const status = response.statusCode;
            response.destroy();
            finish(status >= 200 && status < 300 ? 'ok' : status === 404 || status === 410 ? 'missing' : 'unknown');
        });
        request.on('timeout', () => {
            request.destroy();
            finish('missing');
        });
        // Unreachable hosts are as good as missing to the sender.
        request.on('error', () => finish('missing'));
    });
}


/***/ }),

/***/ 3772:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.UnknownResourceSize = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class UnknownResourceSize {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsUnknownResourceSize(bb, obj) {
        return (obj || new UnknownResourceSize()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsUnknownResourceSize(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new UnknownResourceSize()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static startUnknownResourceSize(builder) {
        builder.startObject(0);
    }
    static endUnknownResourceSize(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createUnknownResourceSize(builder) {
        UnknownResourceSize.startUnknownResourceSize(builder);
        return UnknownResourceSize.endUnknownResourceSize(builder);
    }
}
exports.UnknownResourceSize = UnknownResourceSize;


/***/ }),

/***/ 3806:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DiscoveryService = void 0;
/* eslint-disable @typescript-eslint/no-explicit-any -- multicast-dns is untyped through the modules/ alias */
const crypto = __importStar(__webpack_require__(6982));
const os = __importStar(__webpack_require__(857));
const multicast_dns_1 = __importDefault(__webpack_require__(4003));
const Logger_1 = __webpack_require__(1943);
const Main_1 = __webpack_require__(1759);
const TcpListenerService_1 = __webpack_require__(5693);
const logger = new Logger_1.Logger('DiscoveryService', Logger_1.LoggerType.BACKEND);
const SERVICE_TYPE = '_fcast._tcp.local';
const SERVICE_ENUMERATION = '_services._dns-sd._udp.local';
const MDNS_PORT = 5353;
// RFC 6762 10: host-related records (SRV, A) 120s, the rest 75 minutes.
const HOST_TTL = 120;
const OTHER_TTL = 4500;
// Advertises the receiver as `_fcast._tcp` over mDNS/DNS-SD. A minimal responder on top of
// multicast-dns: it answers PTR/SRV/TXT/A queries for our records, announces them on start, and
// sends a goodbye (TTL 0) on stop.
class DiscoveryService {
    constructor() {
        this.mdns = null;
        this.txt = {};
        this.port = TcpListenerService_1.TcpListenerService.PORT;
    }
    // `txt` holds the protocol TXT records, e.g. { v: '4', fp: '<fingerprint>' }.
    start(txt = {}, port = TcpListenerService_1.TcpListenerService.PORT) {
        if (this.mdns) {
            return;
        }
        const name = (0, Main_1.getComputerName)();
        // DNS labels are dot-separated and at most 63 bytes.
        const label = name.replace(/\./g, '-').substring(0, 63);
        const hostLabel = 'brewcast-' + crypto.createHash('sha1').update(name).digest('hex').substring(0, 8);
        this.instanceName = `${label}.${SERVICE_TYPE}`;
        this.hostName = `${hostLabel}.local`;
        this.port = port;
        // Note that txt field must be populated, otherwise certain mdns stacks have undefined behavior/issues
        // when connecting to the receiver.
        this.txt = Object.assign({ appName: (0, Main_1.getAppName)(), appVersion: (0, Main_1.getAppVersion)() }, txt);
        logger.info(`Discovery service started: ${name}, TXT ${JSON.stringify(this.txt)}`);
        this.mdns = (0, multicast_dns_1.default)({ reuseAddr: true });
        this.mdns.on('error', (err) => logger.warn('mDNS error', err));
        this.mdns.on('warning', (err) => logger.warn('mDNS warning', err));
        this.mdns.on('query', (query, rinfo) => this.handleQuery(query, rinfo));
        // Announce twice, one second apart (RFC 6762 8.3).
        this.announce(false);
        setTimeout(() => this.announce(false), 1000);
    }
    stop() {
        if (this.mdns) {
            const mdns = this.mdns;
            this.announce(true);
            this.mdns = null;
            setTimeout(() => mdns.destroy(), 100);
        }
    }
    addresses() {
        const addresses = [];
        const interfaces = os.networkInterfaces();
        for (const name of Object.keys(interfaces)) {
            for (const address of interfaces[name]) {
                if (!address.internal && (address.family === 'IPv4' || address.family === 4)) {
                    addresses.push(address.address);
                }
            }
        }
        return addresses;
    }
    records(goodbye) {
        const ttl = (value) => goodbye ? 0 : value;
        const txt = Object.keys(this.txt).map((key) => `${key}=${this.txt[key]}`);
        return {
            ptr: { name: SERVICE_TYPE, type: 'PTR', ttl: ttl(OTHER_TTL), data: this.instanceName },
            srv: { name: this.instanceName, type: 'SRV', ttl: ttl(HOST_TTL), flush: true, data: { port: this.port, target: this.hostName, priority: 0, weight: 0 } },
            txt: { name: this.instanceName, type: 'TXT', ttl: ttl(OTHER_TTL), flush: true, data: txt },
            a: this.addresses().map((address) => ({ name: this.hostName, type: 'A', ttl: ttl(HOST_TTL), flush: true, data: address })),
        };
    }
    announce(goodbye) {
        if (!this.mdns) {
            return;
        }
        const records = this.records(goodbye);
        const answers = [records.ptr, records.srv, records.txt];
        this.mdns.respond({ answers: answers.concat(records.a) });
    }
    handleQuery(query, rinfo) {
        const records = this.records(false);
        const answers = [];
        const additionals = [];
        const add = (list, record) => {
            if (list.indexOf(record) === -1) {
                list.push(record);
            }
        };
        for (const question of query.questions) {
            const name = question.name.toLowerCase();
            const type = question.type;
            if (name === SERVICE_ENUMERATION && (type === 'PTR' || type === 'ANY')) {
                add(answers, { name: SERVICE_ENUMERATION, type: 'PTR', ttl: OTHER_TTL, data: SERVICE_TYPE });
            }
            else if (name === SERVICE_TYPE && (type === 'PTR' || type === 'ANY')) {
                add(answers, records.ptr);
                const related = [records.srv, records.txt];
                related.concat(records.a).forEach((record) => add(additionals, record));
            }
            else if (name === this.instanceName.toLowerCase()) {
                if (type === 'SRV' || type === 'ANY') {
                    add(answers, records.srv);
                    records.a.forEach((record) => add(additionals, record));
                }
                if (type === 'TXT' || type === 'ANY') {
                    add(answers, records.txt);
                }
            }
            else if (name === this.hostName.toLowerCase() && (type === 'A' || type === 'ANY')) {
                records.a.forEach((record) => add(answers, record));
            }
        }
        if (answers.length === 0) {
            return;
        }
        // Legacy unicast queries (not from port 5353) get a direct reply that echoes the question.
        if (rinfo && rinfo.port !== MDNS_PORT) {
            this.mdns.respond({ id: query.id, questions: query.questions, answers: answers, additionals: additionals }, rinfo);
        }
        else {
            this.mdns.respond({ answers: answers, additionals: additionals });
        }
    }
}
exports.DiscoveryService = DiscoveryService;


/***/ }),

/***/ 4003:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

var packet = __webpack_require__(1663);
var dgram = __webpack_require__(7194);
var thunky = __webpack_require__(8866);
var events = __webpack_require__(4434);
var os = __webpack_require__(857);
var noop = function () { };
module.exports = function (opts) {
    if (!opts)
        opts = {};
    var that = new events.EventEmitter();
    var port = typeof opts.port === 'number' ? opts.port : 5353;
    var type = opts.type || 'udp4';
    var ip = opts.ip || opts.host || (type === 'udp4' ? '224.0.0.251' : null);
    var me = { address: ip, port: port };
    var memberships = {};
    var destroyed = false;
    var interval = null;
    if (type === 'udp6' && (!ip || !opts.interface)) {
        throw new Error('For IPv6 multicast you must specify `ip` and `interface`');
    }
    var socket = opts.socket || dgram.createSocket({
        type: type,
        reuseAddr: opts.reuseAddr !== false,
        toString: function () {
            return type;
        }
    });
    socket.on('error', function (err) {
        if (err.code === 'EACCES' || err.code === 'EADDRINUSE')
            that.emit('error', err);
        else
            that.emit('warning', err);
    });
    socket.on('message', function (message, rinfo) {
        try {
            message = packet.decode(message);
        }
        catch (err) {
            that.emit('warning', err);
            return;
        }
        that.emit('packet', message, rinfo);
        if (message.type === 'query')
            that.emit('query', message, rinfo);
        if (message.type === 'response')
            that.emit('response', message, rinfo);
    });
    socket.on('listening', function () {
        if (!port)
            port = me.port = socket.address().port;
        if (opts.multicast !== false) {
            that.update();
            interval = setInterval(that.update, 5000);
            socket.setMulticastTTL(opts.ttl || 255);
            socket.setMulticastLoopback(opts.loopback !== false);
        }
    });
    var bind = thunky(function (cb) {
        if (!port || opts.bind === false)
            return cb(null);
        socket.once('error', cb);
        socket.bind(port, opts.bind || opts.interface, function () {
            socket.removeListener('error', cb);
            cb(null);
        });
    });
    bind(function (err) {
        if (err)
            return that.emit('error', err);
        that.emit('ready');
    });
    that.send = function (value, rinfo, cb) {
        if (typeof rinfo === 'function')
            return that.send(value, null, rinfo);
        if (!cb)
            cb = noop;
        if (!rinfo)
            rinfo = me;
        else if (!rinfo.host && !rinfo.address)
            rinfo.address = me.address;
        bind(onbind);
        function onbind(err) {
            if (destroyed)
                return cb();
            if (err)
                return cb(err);
            var message = packet.encode(value);
            socket.send(message, 0, message.length, rinfo.port, rinfo.address || rinfo.host, cb);
        }
    };
    that.response =
        that.respond = function (res, rinfo, cb) {
            if (Array.isArray(res))
                res = { answers: res };
            res.type = 'response';
            res.flags = (res.flags || 0) | packet.AUTHORITATIVE_ANSWER;
            that.send(res, rinfo, cb);
        };
    that.query = function (q, type, rinfo, cb) {
        if (typeof type === 'function')
            return that.query(q, null, null, type);
        if (typeof type === 'object' && type && type.port)
            return that.query(q, null, type, rinfo);
        if (typeof rinfo === 'function')
            return that.query(q, type, null, rinfo);
        if (!cb)
            cb = noop;
        if (typeof q === 'string')
            q = [{ name: q, type: type || 'ANY' }];
        if (Array.isArray(q))
            q = { type: 'query', questions: q };
        q.type = 'query';
        that.send(q, rinfo, cb);
    };
    that.destroy = function (cb) {
        if (!cb)
            cb = noop;
        if (destroyed)
            return process.nextTick(cb);
        destroyed = true;
        clearInterval(interval);
        // Need to drop memberships by hand and ignore errors.
        // socket.close() does not cope with errors.
        for (var iface in memberships) {
            try {
                socket.dropMembership(ip, iface);
            }
            catch (e) {
                // eat it
            }
        }
        memberships = {};
        socket.close(cb);
    };
    that.update = function () {
        var ifaces = opts.interface ? [].concat(opts.interface) : allInterfaces();
        var updated = false;
        for (var i = 0; i < ifaces.length; i++) {
            var addr = ifaces[i];
            if (memberships[addr])
                continue;
            try {
                socket.addMembership(ip, addr);
                memberships[addr] = true;
                updated = true;
            }
            catch (err) {
                that.emit('warning', err);
            }
        }
        if (updated) {
            if (socket.setMulticastInterface) {
                try {
                    socket.setMulticastInterface(opts.interface || defaultInterface());
                }
                catch (err) {
                    that.emit('warning', err);
                }
            }
            that.emit('networkInterface');
        }
    };
    return that;
};
function defaultInterface() {
    var networks = os.networkInterfaces();
    var names = Object.keys(networks);
    for (var i = 0; i < names.length; i++) {
        var net = networks[names[i]];
        for (var j = 0; j < net.length; j++) {
            var iface = net[j];
            if (isIPv4(iface.family) && !iface.internal) {
                if (os.platform() === 'darwin' && names[i] === 'en0')
                    return iface.address;
                return '0.0.0.0';
            }
        }
    }
    return '127.0.0.1';
}
function allInterfaces() {
    var networks = os.networkInterfaces();
    var names = Object.keys(networks);
    var res = [];
    for (var i = 0; i < names.length; i++) {
        var net = networks[names[i]];
        for (var j = 0; j < net.length; j++) {
            var iface = net[j];
            if (isIPv4(iface.family)) {
                res.push(iface.address);
                // could only addMembership once per interface (https://nodejs.org/api/dgram.html#dgram_socket_addmembership_multicastaddress_multicastinterface)
                break;
            }
        }
    }
    return res;
}
function isIPv4(family) {
    return family === 4 || family === 'IPv4';
}


/***/ }),

/***/ 4054:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Stats = void 0;
const constants_1 = __webpack_require__(2612);
const { S_IFMT, S_IFDIR, S_IFREG, S_IFBLK, S_IFCHR, S_IFLNK, S_IFIFO, S_IFSOCK } = constants_1.constants;
/**
 * Statistics about a file/directory, like `fs.Stats`.
 */
class Stats {
    static build(node, bigint = false) {
        const stats = new Stats();
        const { uid, gid, atime, mtime, ctime } = node;
        const getStatNumber = !bigint ? number => number : number => BigInt(number);
        // Copy all values on Stats from Node, so that if Node values
        // change, values on Stats would still be the old ones,
        // just like in Node fs.
        stats.uid = getStatNumber(uid);
        stats.gid = getStatNumber(gid);
        stats.rdev = getStatNumber(node.rdev);
        stats.blksize = getStatNumber(4096);
        stats.ino = getStatNumber(node.ino);
        stats.size = getStatNumber(node.getSize());
        stats.blocks = getStatNumber(1);
        stats.atime = atime;
        stats.mtime = mtime;
        stats.ctime = ctime;
        stats.birthtime = ctime;
        stats.atimeMs = getStatNumber(atime.getTime());
        stats.mtimeMs = getStatNumber(mtime.getTime());
        const ctimeMs = getStatNumber(ctime.getTime());
        stats.ctimeMs = ctimeMs;
        stats.birthtimeMs = ctimeMs;
        if (bigint) {
            stats.atimeNs = BigInt(atime.getTime()) * BigInt(1000000);
            stats.mtimeNs = BigInt(mtime.getTime()) * BigInt(1000000);
            const ctimeNs = BigInt(ctime.getTime()) * BigInt(1000000);
            stats.ctimeNs = ctimeNs;
            stats.birthtimeNs = ctimeNs;
        }
        stats.dev = getStatNumber(0);
        stats.mode = getStatNumber(node.mode);
        stats.nlink = getStatNumber(node.nlink);
        return stats;
    }
    _checkModeProperty(property) {
        return (Number(this.mode) & S_IFMT) === property;
    }
    isDirectory() {
        return this._checkModeProperty(S_IFDIR);
    }
    isFile() {
        return this._checkModeProperty(S_IFREG);
    }
    isBlockDevice() {
        return this._checkModeProperty(S_IFBLK);
    }
    isCharacterDevice() {
        return this._checkModeProperty(S_IFCHR);
    }
    isSymbolicLink() {
        return this._checkModeProperty(S_IFLNK);
    }
    isFIFO() {
        return this._checkModeProperty(S_IFIFO);
    }
    isSocket() {
        return this._checkModeProperty(S_IFSOCK);
    }
}
exports.Stats = Stats;
exports["default"] = Stats;


/***/ }),

/***/ 4057:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports["default"] = typeof queueMicrotask === 'function' ? queueMicrotask : (cb => Promise.resolve()
    .then(() => cb())
    .catch(() => { }));


/***/ }),

/***/ 4097:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Load = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const media_source_1 = __webpack_require__(9659);
class Load {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsLoad(bb, obj) {
        return (obj || new Load()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsLoad(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new Load()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    sourceType() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readUint8(this.bb_pos + offset) : media_source_1.MediaSource.NONE;
    }
    source(obj) {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.__union(obj, this.bb_pos + offset) : null;
    }
    static startLoad(builder) {
        builder.startObject(2);
    }
    static addSourceType(builder, sourceType) {
        builder.addFieldInt8(0, sourceType, media_source_1.MediaSource.NONE);
    }
    static addSource(builder, sourceOffset) {
        builder.addFieldOffset(1, sourceOffset, 0);
    }
    static endLoad(builder) {
        const offset = builder.endObject();
        builder.requiredField(offset, 6); // source
        return offset;
    }
    static createLoad(builder, sourceType, sourceOffset) {
        Load.startLoad(builder);
        Load.addSourceType(builder, sourceType);
        Load.addSource(builder, sourceOffset);
        return Load.endLoad(builder);
    }
}
exports.Load = Load;


/***/ }),

/***/ 4109:
/***/ ((module, exports, __webpack_require__) => {

/* eslint-env browser */
/**
 * This is the web browser implementation of `debug()`.
 */
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.storage = localstorage();
exports.destroy = (() => {
    let warned = false;
    return () => {
        if (!warned) {
            warned = true;
            console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
        }
    };
})();
/**
 * Colors.
 */
exports.colors = [
    '#0000CC',
    '#0000FF',
    '#0033CC',
    '#0033FF',
    '#0066CC',
    '#0066FF',
    '#0099CC',
    '#0099FF',
    '#00CC00',
    '#00CC33',
    '#00CC66',
    '#00CC99',
    '#00CCCC',
    '#00CCFF',
    '#3300CC',
    '#3300FF',
    '#3333CC',
    '#3333FF',
    '#3366CC',
    '#3366FF',
    '#3399CC',
    '#3399FF',
    '#33CC00',
    '#33CC33',
    '#33CC66',
    '#33CC99',
    '#33CCCC',
    '#33CCFF',
    '#6600CC',
    '#6600FF',
    '#6633CC',
    '#6633FF',
    '#66CC00',
    '#66CC33',
    '#9900CC',
    '#9900FF',
    '#9933CC',
    '#9933FF',
    '#99CC00',
    '#99CC33',
    '#CC0000',
    '#CC0033',
    '#CC0066',
    '#CC0099',
    '#CC00CC',
    '#CC00FF',
    '#CC3300',
    '#CC3333',
    '#CC3366',
    '#CC3399',
    '#CC33CC',
    '#CC33FF',
    '#CC6600',
    '#CC6633',
    '#CC9900',
    '#CC9933',
    '#CCCC00',
    '#CCCC33',
    '#FF0000',
    '#FF0033',
    '#FF0066',
    '#FF0099',
    '#FF00CC',
    '#FF00FF',
    '#FF3300',
    '#FF3333',
    '#FF3366',
    '#FF3399',
    '#FF33CC',
    '#FF33FF',
    '#FF6600',
    '#FF6633',
    '#FF9900',
    '#FF9933',
    '#FFCC00',
    '#FFCC33'
];
/**
 * Currently only WebKit-based Web Inspectors, Firefox >= v31,
 * and the Firebug extension (any Firefox version) are known
 * to support "%c" CSS customizations.
 *
 * TODO: add a `localStorage` variable to explicitly enable/disable colors
 */
// eslint-disable-next-line complexity
function useColors() {
    // NB: In an Electron preload script, document will be defined but not fully
    // initialized. Since we know we're in Chrome, we'll just detect this case
    // explicitly
    if (typeof window !== 'undefined' && window.process && (window.process.type === 'renderer' || window.process.__nwjs)) {
        return true;
    }
    // Internet Explorer and Edge do not support colors.
    if (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
        return false;
    }
    let m;
    // Is webkit? http://stackoverflow.com/a/16459606/376773
    // document is undefined in react-native: https://github.com/facebook/react-native/pull/1632
    // eslint-disable-next-line no-return-assign
    return (typeof document !== 'undefined' && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance) ||
        // Is firebug? http://stackoverflow.com/a/398120/376773
        (typeof window !== 'undefined' && window.console && (window.console.firebug || (window.console.exception && window.console.table))) ||
        // Is firefox >= v31?
        // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
        (typeof navigator !== 'undefined' && navigator.userAgent && (m = navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/)) && parseInt(m[1], 10) >= 31) ||
        // Double check webkit in userAgent just in case we are in a worker
        (typeof navigator !== 'undefined' && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/));
}
/**
 * Colorize log arguments if enabled.
 *
 * @api public
 */
function formatArgs(args) {
    args[0] = (this.useColors ? '%c' : '') +
        this.namespace +
        (this.useColors ? ' %c' : ' ') +
        args[0] +
        (this.useColors ? '%c ' : ' ') +
        '+' + module.exports.humanize(this.diff);
    if (!this.useColors) {
        return;
    }
    const c = 'color: ' + this.color;
    args.splice(1, 0, c, 'color: inherit');
    // The final "%c" is somewhat tricky, because there could be other
    // arguments passed either before or after the %c, so we need to
    // figure out the correct index to insert the CSS into
    let index = 0;
    let lastC = 0;
    args[0].replace(/%[a-zA-Z%]/g, match => {
        if (match === '%%') {
            return;
        }
        index++;
        if (match === '%c') {
            // We only are interested in the *last* %c
            // (the user may have provided their own)
            lastC = index;
        }
    });
    args.splice(lastC, 0, c);
}
/**
 * Invokes `console.debug()` when available.
 * No-op when `console.debug` is not a "function".
 * If `console.debug` is not available, falls back
 * to `console.log`.
 *
 * @api public
 */
exports.log = console.debug || console.log || (() => { });
/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */
function save(namespaces) {
    try {
        if (namespaces) {
            exports.storage.setItem('debug', namespaces);
        }
        else {
            exports.storage.removeItem('debug');
        }
    }
    catch (error) {
        // Swallow
        // XXX (@Qix-) should we be logging these?
    }
}
/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */
function load() {
    let r;
    try {
        r = exports.storage.getItem('debug');
    }
    catch (error) {
        // Swallow
        // XXX (@Qix-) should we be logging these?
    }
    // If debug isn't set in LS, and we're in Electron, try to load $DEBUG
    if (!r && typeof process !== 'undefined' && 'env' in process) {
        r = process.env.DEBUG;
    }
    return r;
}
/**
 * Localstorage attempts to return the localstorage.
 *
 * This is necessary because safari throws
 * when a user disables cookies/localstorage
 * and you attempt to access it.
 *
 * @return {LocalStorage}
 * @api private
 */
function localstorage() {
    try {
        // TVMLKit (Apple TV JS Runtime) does not have a window object, just localStorage in the global context
        // The Browser also has localStorage in the global context.
        return localStorage;
    }
    catch (error) {
        // Swallow
        // XXX (@Qix-) should we be logging these?
    }
}
module.exports = __webpack_require__(5148)(exports);
const { formatters } = module.exports;
/**
 * Map %j to `JSON.stringify()`, since no Web Inspectors do that by default.
 */
formatters.j = function (v) {
    try {
        return JSON.stringify(v);
    }
    catch (error) {
        return '[UnexpectedJSONParseError]: ' + error.message;
    }
};


/***/ }),

/***/ 4174:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

exports.toString = function (type) {
    switch (type) {
        // list at
        // https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-11
        case 1: return 'LLQ';
        case 2: return 'UL';
        case 3: return 'NSID';
        case 5: return 'DAU';
        case 6: return 'DHU';
        case 7: return 'N3U';
        case 8: return 'CLIENT_SUBNET';
        case 9: return 'EXPIRE';
        case 10: return 'COOKIE';
        case 11: return 'TCP_KEEPALIVE';
        case 12: return 'PADDING';
        case 13: return 'CHAIN';
        case 14: return 'KEY_TAG';
        case 26946: return 'DEVICEID';
    }
    if (type < 0) {
        return null;
    }
    return `OPTION_${type}`;
};
exports.toCode = function (name) {
    if (typeof name === 'number') {
        return name;
    }
    if (!name) {
        return -1;
    }
    switch (name.toUpperCase()) {
        case 'OPTION_0': return 0;
        case 'LLQ': return 1;
        case 'UL': return 2;
        case 'NSID': return 3;
        case 'OPTION_4': return 4;
        case 'DAU': return 5;
        case 'DHU': return 6;
        case 'N3U': return 7;
        case 'CLIENT_SUBNET': return 8;
        case 'EXPIRE': return 9;
        case 'COOKIE': return 10;
        case 'TCP_KEEPALIVE': return 11;
        case 'PADDING': return 12;
        case 'CHAIN': return 13;
        case 'KEY_TAG': return 14;
        case 'DEVICEID': return 26946;
        case 'OPTION_65535': return 65535;
    }
    const m = name.match(/_(\d+)$/);
    if (m) {
        return parseInt(m[1], 10);
    }
    return -1;
};


/***/ }),

/***/ 4200:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.printBinary = void 0;
const printBinary = (tab = '', children) => {
    const left = children[0], right = children[1];
    let str = '';
    if (left)
        str += '\n' + tab + '← ' + left(tab + '  ');
    if (right)
        str += '\n' + tab + '→ ' + right(tab + '  ');
    return str;
};
exports.printBinary = printBinary;


/***/ }),

/***/ 4281:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SetProgressUpdateInterval = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const time_1 = __webpack_require__(6004);
class SetProgressUpdateInterval {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsSetProgressUpdateInterval(bb, obj) {
        return (obj || new SetProgressUpdateInterval()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsSetProgressUpdateInterval(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new SetProgressUpdateInterval()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    interval(obj) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? (obj || new time_1.Time()).__init(this.bb_pos + offset, this.bb) : null;
    }
    static startSetProgressUpdateInterval(builder) {
        builder.startObject(1);
    }
    static addInterval(builder, intervalOffset) {
        builder.addFieldStruct(0, intervalOffset, 0);
    }
    static endSetProgressUpdateInterval(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createSetProgressUpdateInterval(builder, intervalOffset) {
        SetProgressUpdateInterval.startSetProgressUpdateInterval(builder);
        SetProgressUpdateInterval.addInterval(builder, intervalOffset);
        return SetProgressUpdateInterval.endSetProgressUpdateInterval(builder);
    }
}
exports.SetProgressUpdateInterval = SetProgressUpdateInterval;


/***/ }),

/***/ 4340:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.QueueItemSelected = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const queue_position_1 = __webpack_require__(7548);
class QueueItemSelected {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsQueueItemSelected(bb, obj) {
        return (obj || new QueueItemSelected()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsQueueItemSelected(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new QueueItemSelected()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    positionType() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readUint8(this.bb_pos + offset) : queue_position_1.QueuePosition.NONE;
    }
    position(obj) {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.__union(obj, this.bb_pos + offset) : null;
    }
    static startQueueItemSelected(builder) {
        builder.startObject(2);
    }
    static addPositionType(builder, positionType) {
        builder.addFieldInt8(0, positionType, queue_position_1.QueuePosition.NONE);
    }
    static addPosition(builder, positionOffset) {
        builder.addFieldOffset(1, positionOffset, 0);
    }
    static endQueueItemSelected(builder) {
        const offset = builder.endObject();
        builder.requiredField(offset, 6); // position
        return offset;
    }
    static createQueueItemSelected(builder, positionType, positionOffset) {
        QueueItemSelected.startQueueItemSelected(builder);
        QueueItemSelected.addPositionType(builder, positionType);
        QueueItemSelected.addPosition(builder, positionOffset);
        return QueueItemSelected.endQueueItemSelected(builder);
    }
}
exports.QueueItemSelected = QueueItemSelected;


/***/ }),

/***/ 4434:
/***/ ((module) => {

"use strict";
module.exports = require("events");

/***/ }),

/***/ 4453:
/***/ ((module) => {

/**
 * Helpers.
 */
var s = 1000;
var m = s * 60;
var h = m * 60;
var d = h * 24;
var w = d * 7;
var y = d * 365.25;
/**
 * Parse or format the given `val`.
 *
 * Options:
 *
 *  - `long` verbose formatting [false]
 *
 * @param {String|Number} val
 * @param {Object} [options]
 * @throws {Error} throw an error if val is not a non-empty string or a number
 * @return {String|Number}
 * @api public
 */
module.exports = function (val, options) {
    options = options || {};
    var type = typeof val;
    if (type === 'string' && val.length > 0) {
        return parse(val);
    }
    else if (type === 'number' && isFinite(val)) {
        return options.long ? fmtLong(val) : fmtShort(val);
    }
    throw new Error('val is not a non-empty string or a valid number. val=' +
        JSON.stringify(val));
};
/**
 * Parse the given `str` and return milliseconds.
 *
 * @param {String} str
 * @return {Number}
 * @api private
 */
function parse(str) {
    str = String(str);
    if (str.length > 100) {
        return;
    }
    var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(str);
    if (!match) {
        return;
    }
    var n = parseFloat(match[1]);
    var type = (match[2] || 'ms').toLowerCase();
    switch (type) {
        case 'years':
        case 'year':
        case 'yrs':
        case 'yr':
        case 'y':
            return n * y;
        case 'weeks':
        case 'week':
        case 'w':
            return n * w;
        case 'days':
        case 'day':
        case 'd':
            return n * d;
        case 'hours':
        case 'hour':
        case 'hrs':
        case 'hr':
        case 'h':
            return n * h;
        case 'minutes':
        case 'minute':
        case 'mins':
        case 'min':
        case 'm':
            return n * m;
        case 'seconds':
        case 'second':
        case 'secs':
        case 'sec':
        case 's':
            return n * s;
        case 'milliseconds':
        case 'millisecond':
        case 'msecs':
        case 'msec':
        case 'ms':
            return n;
        default:
            return undefined;
    }
}
/**
 * Short format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */
function fmtShort(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
        return Math.round(ms / d) + 'd';
    }
    if (msAbs >= h) {
        return Math.round(ms / h) + 'h';
    }
    if (msAbs >= m) {
        return Math.round(ms / m) + 'm';
    }
    if (msAbs >= s) {
        return Math.round(ms / s) + 's';
    }
    return ms + 'ms';
}
/**
 * Long format for `ms`.
 *
 * @param {Number} ms
 * @return {String}
 * @api private
 */
function fmtLong(ms) {
    var msAbs = Math.abs(ms);
    if (msAbs >= d) {
        return plural(ms, msAbs, d, 'day');
    }
    if (msAbs >= h) {
        return plural(ms, msAbs, h, 'hour');
    }
    if (msAbs >= m) {
        return plural(ms, msAbs, m, 'minute');
    }
    if (msAbs >= s) {
        return plural(ms, msAbs, s, 'second');
    }
    return ms + ' ms';
}
/**
 * Pluralization helper.
 */
function plural(ms, msAbs, n, name) {
    var isPlural = msAbs >= n * 1.5;
    return Math.round(ms / n) + ' ' + name + (isPlural ? 's' : '');
}


/***/ }),

/***/ 4560:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MetadataKV = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const generic_meta_value_1 = __webpack_require__(1620);
class MetadataKV {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsMetadataKV(bb, obj) {
        return (obj || new MetadataKV()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsMetadataKV(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new MetadataKV()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    key(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    valueType() {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.readUint8(this.bb_pos + offset) : generic_meta_value_1.GenericMetaValue.NONE;
    }
    value(obj) {
        const offset = this.bb.__offset(this.bb_pos, 8);
        return offset ? this.bb.__union(obj, this.bb_pos + offset) : null;
    }
    static startMetadataKV(builder) {
        builder.startObject(3);
    }
    static addKey(builder, keyOffset) {
        builder.addFieldOffset(0, keyOffset, 0);
    }
    static addValueType(builder, valueType) {
        builder.addFieldInt8(1, valueType, generic_meta_value_1.GenericMetaValue.NONE);
    }
    static addValue(builder, valueOffset) {
        builder.addFieldOffset(2, valueOffset, 0);
    }
    static endMetadataKV(builder) {
        const offset = builder.endObject();
        builder.requiredField(offset, 4); // key
        return offset;
    }
    static createMetadataKV(builder, keyOffset, valueType, valueOffset) {
        MetadataKV.startMetadataKV(builder);
        MetadataKV.addKey(builder, keyOffset);
        MetadataKV.addValueType(builder, valueType);
        MetadataKV.addValue(builder, valueOffset);
        return MetadataKV.endMetadataKV(builder);
    }
}
exports.MetadataKV = MetadataKV;


/***/ }),

/***/ 4683:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.printJson = void 0;
const printJson = (tab = '', json, space = 2) => (JSON.stringify(json, null, space) || 'nil').split('\n').join('\n' + tab);
exports.printJson = printJson;


/***/ }),

/***/ 4721:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.v4UnsupportedReason = v4UnsupportedReason;
exports.spkiFingerprint = spkiFingerprint;
exports.createSelfSignedCertificate = createSelfSignedCertificate;
exports.identityFromKey = identityFromKey;
exports.loadOrCreateV4Identity = loadOrCreateV4Identity;
const crypto = __importStar(__webpack_require__(6982));
const fs = __importStar(__webpack_require__(9896));
const tls = __importStar(__webpack_require__(4756));
const Logger_1 = __webpack_require__(1943);
const logger = new Logger_1.Logger('V4Certificate', Logger_1.LoggerType.BACKEND);
// Returns why protocol v4 can't run on this Node runtime, or null when it can. v4 needs TLS 1.3
// (Node 12+), the KeyObject/crypto.sign APIs used below, and BigInt plus TextEncoder/TextDecoder for
// FlatBuffers.
function v4UnsupportedReason() {
    if (typeof BigInt !== 'function') {
        return 'BigInt is not available';
    }
    if (typeof TextEncoder !== 'function' || typeof TextDecoder !== 'function') {
        return 'TextEncoder/TextDecoder are not available';
    }
    if (typeof crypto.generateKeyPairSync !== 'function' || typeof crypto.sign !== 'function' || typeof crypto.createPrivateKey !== 'function') {
        return 'crypto key APIs are not available';
    }
    if (typeof tls.DEFAULT_MAX_VERSION !== 'string') {
        return 'TLS 1.3 is not available';
    }
    return null;
}
function derLength(length) {
    if (length < 0x80) {
        return Buffer.from([length]);
    }
    const bytes = [];
    for (let n = length; n > 0; n = Math.floor(n / 256)) {
        bytes.unshift(n % 256);
    }
    return Buffer.from([0x80 | bytes.length].concat(bytes));
}
function der(tag, ...content) {
    const body = Buffer.concat(content);
    return Buffer.concat([Buffer.from([tag]), derLength(body.length), body]);
}
function derSequence(...content) {
    return der(0x30, ...content);
}
// Unsigned big-endian integer from `value`.
function derInteger(value) {
    let start = 0;
    while (start < value.length - 1 && value[start] === 0) {
        start++;
    }
    let bytes = value.subarray(start);
    if (bytes[0] & 0x80) {
        bytes = Buffer.concat([Buffer.from([0]), bytes]);
    }
    return der(0x02, bytes);
}
// RFC 5280 4.1.2.5: UTCTime for years 1950-2049, GeneralizedTime otherwise.
function derTime(date) {
    const pad = (n, width = 2) => n.toString().padStart(width, '0');
    const year = date.getUTCFullYear();
    const rest = pad(date.getUTCMonth() + 1) + pad(date.getUTCDate()) + pad(date.getUTCHours()) +
        pad(date.getUTCMinutes()) + pad(date.getUTCSeconds()) + 'Z';
    if (year >= 1950 && year < 2050) {
        return der(0x17, Buffer.from(pad(year % 100) + rest, 'ascii'));
    }
    return der(0x18, Buffer.from(pad(year, 4) + rest, 'ascii'));
}
function toPem(label, derBytes) {
    const lines = derBytes.toString('base64').match(/.{1,64}/g);
    return `-----BEGIN ${label}-----\n${lines.join('\n')}\n-----END ${label}-----\n`;
}
// AlgorithmIdentifier for ecdsa-with-SHA256 (1.2.840.10045.4.3.2), parameters absent.
const ECDSA_WITH_SHA256 = derSequence(Buffer.from('06082a8648ce3d040302', 'hex'));
const EMPTY_NAME = derSequence();
function spkiFingerprint(publicKey) {
    const spki = publicKey.export({ type: 'spki', format: 'der' });
    return crypto.createHash('sha256').update(spki).digest('base64');
}
function createSelfSignedCertificate(privateKey) {
    const publicKey = crypto.createPublicKey(privateKey);
    const serial = crypto.randomBytes(16);
    serial[0] &= 0x7f;
    const tbsCertificate = derSequence(der(0xa0, derInteger(Buffer.from([2]))), // version: v3
    derInteger(serial), ECDSA_WITH_SHA256, EMPTY_NAME, // issuer
    derSequence(derTime(new Date(Date.UTC(1975, 0, 1))), derTime(new Date(Date.UTC(4096, 0, 1)))), EMPTY_NAME, // subject
    publicKey.export({ type: 'spki', format: 'der' }));
    // Node's ECDSA signatures are DER-encoded Ecdsa-Sig-Value, as X.509 expects.
    const signature = crypto.sign('sha256', tbsCertificate, privateKey);
    return derSequence(tbsCertificate, ECDSA_WITH_SHA256, der(0x03, Buffer.from([0]), signature));
}
function identityFromKey(privateKey) {
    const keyPem = privateKey.export({ type: 'pkcs8', format: 'pem' }).toString();
    const certPem = toPem('CERTIFICATE', createSelfSignedCertificate(privateKey));
    return {
        keyPem: keyPem,
        certPem: certPem,
        fingerprint: spkiFingerprint(crypto.createPublicKey(privateKey)),
        secureContext: tls.createSecureContext({
            key: keyPem,
            cert: certPem,
            minVersion: 'TLSv1.3',
            maxVersion: 'TLSv1.3',
        }),
    };
}
// Loads the private key from `keyPath`, or creates one and tries to store it there, so the
// fingerprint stays stable across restarts. Only the key is stored; the certificate is re-issued
// on every start (senders pin the key, not the certificate). Pass null for an ephemeral key.
function loadOrCreateV4Identity(keyPath) {
    if (keyPath !== null) {
        try {
            if (fs.existsSync(keyPath)) {
                return identityFromKey(crypto.createPrivateKey(fs.readFileSync(keyPath, 'utf8')));
            }
        }
        catch (e) {
            logger.warn(`Could not load the v4 key from ${keyPath}, creating a new one`, e);
        }
    }
    const { privateKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const identity = identityFromKey(privateKey);
    if (keyPath !== null) {
        try {
            fs.writeFileSync(keyPath, identity.keyPem, { mode: 0o600 });
        }
        catch (e) {
            logger.warn(`Could not store the v4 key at ${keyPath}; the fingerprint will change on restart`, e);
        }
    }
    return identity;
}


/***/ }),

/***/ 4756:
/***/ ((module) => {

"use strict";
module.exports = require("tls");

/***/ }),

/***/ 4777:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CompanionResourceInfoRequest = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class CompanionResourceInfoRequest {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsCompanionResourceInfoRequest(bb, obj) {
        return (obj || new CompanionResourceInfoRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsCompanionResourceInfoRequest(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new CompanionResourceInfoRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    requestId() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readUint32(this.bb_pos + offset) : 0;
    }
    resourceId() {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.readUint32(this.bb_pos + offset) : 0;
    }
    static startCompanionResourceInfoRequest(builder) {
        builder.startObject(2);
    }
    static addRequestId(builder, requestId) {
        builder.addFieldInt32(0, requestId, 0);
    }
    static addResourceId(builder, resourceId) {
        builder.addFieldInt32(1, resourceId, 0);
    }
    static endCompanionResourceInfoRequest(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createCompanionResourceInfoRequest(builder, requestId, resourceId) {
        CompanionResourceInfoRequest.startCompanionResourceInfoRequest(builder);
        CompanionResourceInfoRequest.addRequestId(builder, requestId);
        CompanionResourceInfoRequest.addResourceId(builder, resourceId);
        return CompanionResourceInfoRequest.endCompanionResourceInfoRequest(builder);
    }
}
exports.CompanionResourceInfoRequest = CompanionResourceInfoRequest;


/***/ }),

/***/ 4784:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.unixify = exports.getWriteSyncArgs = exports.getWriteArgs = exports.bufToUint8 = exports.isWin = void 0;
exports.promisify = promisify;
exports.validateCallback = validateCallback;
exports.modeToNumber = modeToNumber;
exports.nullCheck = nullCheck;
exports.pathToFilename = pathToFilename;
exports.createError = createError;
exports.genRndStr6 = genRndStr6;
exports.flagsToNumber = flagsToNumber;
exports.isFd = isFd;
exports.validateFd = validateFd;
exports.streamToBuffer = streamToBuffer;
exports.dataToBuffer = dataToBuffer;
exports.bufferToEncoding = bufferToEncoding;
exports.isReadableStream = isReadableStream;
const constants_1 = __webpack_require__(1983);
const errors = __webpack_require__(9608);
const buffer_1 = __webpack_require__(9897);
const encoding_1 = __webpack_require__(2708);
const buffer_2 = __webpack_require__(9897);
const queueMicrotask_1 = __webpack_require__(4057);
exports.isWin = process.platform === 'win32';
function promisify(fs, fn, getResult = input => input) {
    return (...args) => new Promise((resolve, reject) => {
        fs[fn].bind(fs)(...args, (error, result) => {
            if (error)
                return reject(error);
            return resolve(getResult(result));
        });
    });
}
function validateCallback(callback) {
    if (typeof callback !== 'function')
        throw TypeError(constants_1.ERRSTR.CB);
    return callback;
}
function _modeToNumber(mode, def) {
    if (typeof mode === 'number')
        return mode;
    if (typeof mode === 'string')
        return parseInt(mode, 8);
    if (def)
        return modeToNumber(def);
    return undefined;
}
function modeToNumber(mode, def) {
    const result = _modeToNumber(mode, def);
    if (typeof result !== 'number' || isNaN(result))
        throw new TypeError(constants_1.ERRSTR.MODE_INT);
    return result;
}
function nullCheck(path, callback) {
    if (('' + path).indexOf('\u0000') !== -1) {
        const er = new Error('Path must be a string without null bytes');
        er.code = 'ENOENT';
        if (typeof callback !== 'function')
            throw er;
        (0, queueMicrotask_1.default)(() => {
            callback(er);
        });
        return false;
    }
    return true;
}
function getPathFromURLPosix(url) {
    if (url.hostname !== '') {
        throw new errors.TypeError('ERR_INVALID_FILE_URL_HOST', process.platform);
    }
    const pathname = url.pathname;
    for (let n = 0; n < pathname.length; n++) {
        if (pathname[n] === '%') {
            const third = pathname.codePointAt(n + 2) | 0x20;
            if (pathname[n + 1] === '2' && third === 102) {
                throw new errors.TypeError('ERR_INVALID_FILE_URL_PATH', 'must not include encoded / characters');
            }
        }
    }
    return decodeURIComponent(pathname);
}
function pathToFilename(path) {
    if (path instanceof Uint8Array) {
        path = (0, buffer_2.bufferFrom)(path);
    }
    if (typeof path !== 'string' && !buffer_1.Buffer.isBuffer(path)) {
        try {
            if (!(path instanceof (__webpack_require__(7016).URL)))
                throw new TypeError(constants_1.ERRSTR.PATH_STR);
        }
        catch (err) {
            throw new TypeError(constants_1.ERRSTR.PATH_STR);
        }
        path = getPathFromURLPosix(path);
    }
    const pathString = String(path);
    nullCheck(pathString);
    // return slash(pathString);
    return pathString;
}
const ENOENT = 'ENOENT';
const EBADF = 'EBADF';
const EINVAL = 'EINVAL';
const EPERM = 'EPERM';
const EPROTO = 'EPROTO';
const EEXIST = 'EEXIST';
const ENOTDIR = 'ENOTDIR';
const EMFILE = 'EMFILE';
const EACCES = 'EACCES';
const EISDIR = 'EISDIR';
const ENOTEMPTY = 'ENOTEMPTY';
const ENOSYS = 'ENOSYS';
const ERR_FS_EISDIR = 'ERR_FS_EISDIR';
const ERR_OUT_OF_RANGE = 'ERR_OUT_OF_RANGE';
function formatError(errorCode, func = '', path = '', path2 = '') {
    let pathFormatted = '';
    if (path)
        pathFormatted = ` '${path}'`;
    if (path2)
        pathFormatted += ` -> '${path2}'`;
    switch (errorCode) {
        case ENOENT:
            return `ENOENT: no such file or directory, ${func}${pathFormatted}`;
        case EBADF:
            return `EBADF: bad file descriptor, ${func}${pathFormatted}`;
        case EINVAL:
            return `EINVAL: invalid argument, ${func}${pathFormatted}`;
        case EPERM:
            return `EPERM: operation not permitted, ${func}${pathFormatted}`;
        case EPROTO:
            return `EPROTO: protocol error, ${func}${pathFormatted}`;
        case EEXIST:
            return `EEXIST: file already exists, ${func}${pathFormatted}`;
        case ENOTDIR:
            return `ENOTDIR: not a directory, ${func}${pathFormatted}`;
        case EISDIR:
            return `EISDIR: illegal operation on a directory, ${func}${pathFormatted}`;
        case EACCES:
            return `EACCES: permission denied, ${func}${pathFormatted}`;
        case ENOTEMPTY:
            return `ENOTEMPTY: directory not empty, ${func}${pathFormatted}`;
        case EMFILE:
            return `EMFILE: too many open files, ${func}${pathFormatted}`;
        case ENOSYS:
            return `ENOSYS: function not implemented, ${func}${pathFormatted}`;
        case ERR_FS_EISDIR:
            return `[ERR_FS_EISDIR]: Path is a directory: ${func} returned EISDIR (is a directory) ${path}`;
        case ERR_OUT_OF_RANGE:
            return `[ERR_OUT_OF_RANGE]: value out of range, ${func}${pathFormatted}`;
        default:
            return `${errorCode}: error occurred, ${func}${pathFormatted}`;
    }
}
function createError(errorCode, func = '', path = '', path2 = '', Constructor = Error) {
    const error = new Constructor(formatError(errorCode, func, path, path2));
    error.code = errorCode;
    if (path) {
        error.path = path;
    }
    return error;
}
function genRndStr6() {
    const str = (Math.random() + 1).toString(36).substring(2, 8);
    if (str.length === 6)
        return str;
    else
        return genRndStr6();
}
function flagsToNumber(flags) {
    if (typeof flags === 'number')
        return flags;
    if (typeof flags === 'string') {
        const flagsNum = constants_1.FLAGS[flags];
        if (typeof flagsNum !== 'undefined')
            return flagsNum;
    }
    // throw new TypeError(formatError(ERRSTR_FLAG(flags)));
    throw new errors.TypeError('ERR_INVALID_OPT_VALUE', 'flags', flags);
}
function isFd(path) {
    return path >>> 0 === path;
}
function validateFd(fd) {
    if (!isFd(fd))
        throw TypeError(constants_1.ERRSTR.FD);
}
function streamToBuffer(stream) {
    const chunks = [];
    return new Promise((resolve, reject) => {
        stream.on('data', chunk => chunks.push(chunk));
        stream.on('end', () => resolve(buffer_1.Buffer.concat(chunks)));
        stream.on('error', reject);
    });
}
function dataToBuffer(data, encoding = encoding_1.ENCODING_UTF8) {
    if (buffer_1.Buffer.isBuffer(data))
        return data;
    else if (data instanceof Uint8Array)
        return (0, buffer_2.bufferFrom)(data);
    else
        return (0, buffer_2.bufferFrom)(String(data), encoding);
}
const bufToUint8 = (buf) => new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
exports.bufToUint8 = bufToUint8;
const getWriteArgs = (fd, a, b, c, d, e) => {
    validateFd(fd);
    let offset = 0;
    let length;
    let position = null;
    let encoding;
    let callback;
    const tipa = typeof a;
    const tipb = typeof b;
    const tipc = typeof c;
    const tipd = typeof d;
    if (tipa !== 'string') {
        if (tipb === 'function') {
            callback = b;
        }
        else if (tipc === 'function') {
            offset = b | 0;
            callback = c;
        }
        else if (tipd === 'function') {
            offset = b | 0;
            length = c;
            callback = d;
        }
        else {
            offset = b | 0;
            length = c;
            position = d;
            callback = e;
        }
    }
    else {
        if (tipb === 'function') {
            callback = b;
        }
        else if (tipc === 'function') {
            position = b;
            callback = c;
        }
        else if (tipd === 'function') {
            position = b;
            encoding = c;
            callback = d;
        }
    }
    const buf = dataToBuffer(a, encoding);
    if (tipa !== 'string') {
        if (typeof length === 'undefined')
            length = buf.length;
    }
    else {
        offset = 0;
        length = buf.length;
    }
    const cb = validateCallback(callback);
    return [fd, tipa === 'string', buf, offset, length, position, cb];
};
exports.getWriteArgs = getWriteArgs;
const getWriteSyncArgs = (fd, a, b, c, d) => {
    validateFd(fd);
    let encoding;
    let offset;
    let length;
    let position;
    const isBuffer = typeof a !== 'string';
    if (isBuffer) {
        offset = (b || 0) | 0;
        length = c;
        position = d;
    }
    else {
        position = b;
        encoding = c;
    }
    const buf = dataToBuffer(a, encoding);
    if (isBuffer) {
        if (typeof length === 'undefined') {
            length = buf.length;
        }
    }
    else {
        offset = 0;
        length = buf.length;
    }
    return [fd, buf, offset || 0, length, position];
};
exports.getWriteSyncArgs = getWriteSyncArgs;
function bufferToEncoding(buffer, encoding) {
    if (!encoding || encoding === 'buffer')
        return buffer;
    else
        return buffer.toString(encoding);
}
function isReadableStream(stream) {
    return (stream !== null &&
        typeof stream === 'object' &&
        typeof stream.pipe === 'function' &&
        typeof stream.on === 'function' &&
        stream.readable === true);
}
const isSeparator = (str, i) => {
    let char = str[i];
    return i > 0 && (char === '/' || (exports.isWin && char === '\\'));
};
const removeTrailingSeparator = (str) => {
    let i = str.length - 1;
    if (i < 2)
        return str;
    while (isSeparator(str, i))
        i--;
    return str.substr(0, i + 1);
};
const normalizePath = (str, stripTrailing) => {
    if (typeof str !== 'string')
        throw new TypeError('expected a string');
    str = str.replace(/[\\\/]+/g, '/');
    if (stripTrailing !== false)
        str = removeTrailingSeparator(str);
    return str;
};
const unixify = (filepath, stripTrailing = true) => {
    if (exports.isWin) {
        filepath = normalizePath(filepath, stripTrailing);
        return filepath.replace(/^([a-zA-Z]+:|\.\/)/, '');
    }
    return filepath;
};
exports.unixify = unixify;


/***/ }),

/***/ 4863:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TracksAvailable = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const media_track_1 = __webpack_require__(8335);
class TracksAvailable {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsTracksAvailable(bb, obj) {
        return (obj || new TracksAvailable()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsTracksAvailable(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new TracksAvailable()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    tracks(index, obj) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? (obj || new media_track_1.MediaTrack()).__init(this.bb.__indirect(this.bb.__vector(this.bb_pos + offset) + index * 4), this.bb) : null;
    }
    tracksLength() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
    }
    static startTracksAvailable(builder) {
        builder.startObject(1);
    }
    static addTracks(builder, tracksOffset) {
        builder.addFieldOffset(0, tracksOffset, 0);
    }
    static createTracksVector(builder, data) {
        builder.startVector(4, data.length, 4);
        for (let i = data.length - 1; i >= 0; i--) {
            builder.addOffset(data[i]);
        }
        return builder.endVector();
    }
    static startTracksVector(builder, numElems) {
        builder.startVector(4, numElems, 4);
    }
    static endTracksAvailable(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createTracksAvailable(builder, tracksOffset) {
        TracksAvailable.startTracksAvailable(builder);
        TracksAvailable.addTracks(builder, tracksOffset);
        return TracksAvailable.endTracksAvailable(builder);
    }
}
exports.TracksAvailable = TracksAvailable;


/***/ }),

/***/ 4947:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ReceiverCapabilities = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const audio_capabilities_1 = __webpack_require__(1162);
const display_capabilities_1 = __webpack_require__(2126);
const media_capabilities_1 = __webpack_require__(2292);
class ReceiverCapabilities {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsReceiverCapabilities(bb, obj) {
        return (obj || new ReceiverCapabilities()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsReceiverCapabilities(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new ReceiverCapabilities()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    media(obj) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? (obj || new media_capabilities_1.MediaCapabilities()).__init(this.bb.__indirect(this.bb_pos + offset), this.bb) : null;
    }
    display(obj) {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? (obj || new display_capabilities_1.DisplayCapabilities()).__init(this.bb.__indirect(this.bb_pos + offset), this.bb) : null;
    }
    audio(obj) {
        const offset = this.bb.__offset(this.bb_pos, 8);
        return offset ? (obj || new audio_capabilities_1.AudioCapabilities()).__init(this.bb.__indirect(this.bb_pos + offset), this.bb) : null;
    }
    static startReceiverCapabilities(builder) {
        builder.startObject(3);
    }
    static addMedia(builder, mediaOffset) {
        builder.addFieldOffset(0, mediaOffset, 0);
    }
    static addDisplay(builder, displayOffset) {
        builder.addFieldOffset(1, displayOffset, 0);
    }
    static addAudio(builder, audioOffset) {
        builder.addFieldOffset(2, audioOffset, 0);
    }
    static endReceiverCapabilities(builder) {
        const offset = builder.endObject();
        return offset;
    }
}
exports.ReceiverCapabilities = ReceiverCapabilities;


/***/ }),

/***/ 5018:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CompanionHelloRequest = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class CompanionHelloRequest {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsCompanionHelloRequest(bb, obj) {
        return (obj || new CompanionHelloRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsCompanionHelloRequest(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new CompanionHelloRequest()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static startCompanionHelloRequest(builder) {
        builder.startObject(0);
    }
    static endCompanionHelloRequest(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createCompanionHelloRequest(builder) {
        CompanionHelloRequest.startCompanionHelloRequest(builder);
        return CompanionHelloRequest.endCompanionHelloRequest(builder);
    }
}
exports.CompanionHelloRequest = CompanionHelloRequest;


/***/ }),

/***/ 5148:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

/**
 * This is the common logic for both the Node.js and web browser
 * implementations of `debug()`.
 */
function setup(env) {
    createDebug.debug = createDebug;
    createDebug.default = createDebug;
    createDebug.coerce = coerce;
    createDebug.disable = disable;
    createDebug.enable = enable;
    createDebug.enabled = enabled;
    createDebug.humanize = __webpack_require__(4453);
    createDebug.destroy = destroy;
    Object.keys(env).forEach(key => {
        createDebug[key] = env[key];
    });
    /**
    * The currently active debug mode names, and names to skip.
    */
    createDebug.names = [];
    createDebug.skips = [];
    /**
    * Map of special "%n" handling functions, for the debug "format" argument.
    *
    * Valid key names are a single, lower or upper-case letter, i.e. "n" and "N".
    */
    createDebug.formatters = {};
    /**
    * Selects a color for a debug namespace
    * @param {String} namespace The namespace string for the debug instance to be colored
    * @return {Number|String} An ANSI color code for the given namespace
    * @api private
    */
    function selectColor(namespace) {
        let hash = 0;
        for (let i = 0; i < namespace.length; i++) {
            hash = ((hash << 5) - hash) + namespace.charCodeAt(i);
            hash |= 0; // Convert to 32bit integer
        }
        return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
    }
    createDebug.selectColor = selectColor;
    /**
    * Create a debugger with the given `namespace`.
    *
    * @param {String} namespace
    * @return {Function}
    * @api public
    */
    function createDebug(namespace) {
        let prevTime;
        let enableOverride = null;
        let namespacesCache;
        let enabledCache;
        function debug(...args) {
            // Disabled?
            if (!debug.enabled) {
                return;
            }
            const self = debug;
            // Set `diff` timestamp
            const curr = Number(new Date());
            const ms = curr - (prevTime || curr);
            self.diff = ms;
            self.prev = prevTime;
            self.curr = curr;
            prevTime = curr;
            args[0] = createDebug.coerce(args[0]);
            if (typeof args[0] !== 'string') {
                // Anything else let's inspect with %O
                args.unshift('%O');
            }
            // Apply any `formatters` transformations
            let index = 0;
            args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
                // If we encounter an escaped % then don't increase the array index
                if (match === '%%') {
                    return '%';
                }
                index++;
                const formatter = createDebug.formatters[format];
                if (typeof formatter === 'function') {
                    const val = args[index];
                    match = formatter.call(self, val);
                    // Now we need to remove `args[index]` since it's inlined in the `format`
                    args.splice(index, 1);
                    index--;
                }
                return match;
            });
            // Apply env-specific formatting (colors, etc.)
            createDebug.formatArgs.call(self, args);
            const logFn = self.log || createDebug.log;
            logFn.apply(self, args);
        }
        debug.namespace = namespace;
        debug.useColors = createDebug.useColors();
        debug.color = createDebug.selectColor(namespace);
        debug.extend = extend;
        debug.destroy = createDebug.destroy; // XXX Temporary. Will be removed in the next major release.
        Object.defineProperty(debug, 'enabled', {
            enumerable: true,
            configurable: false,
            get: () => {
                if (enableOverride !== null) {
                    return enableOverride;
                }
                if (namespacesCache !== createDebug.namespaces) {
                    namespacesCache = createDebug.namespaces;
                    enabledCache = createDebug.enabled(namespace);
                }
                return enabledCache;
            },
            set: v => {
                enableOverride = v;
            }
        });
        // Env-specific initialization logic for debug instances
        if (typeof createDebug.init === 'function') {
            createDebug.init(debug);
        }
        return debug;
    }
    function extend(namespace, delimiter) {
        const newDebug = createDebug(this.namespace + (typeof delimiter === 'undefined' ? ':' : delimiter) + namespace);
        newDebug.log = this.log;
        return newDebug;
    }
    /**
    * Enables a debug mode by namespaces. This can include modes
    * separated by a colon and wildcards.
    *
    * @param {String} namespaces
    * @api public
    */
    function enable(namespaces) {
        createDebug.save(namespaces);
        createDebug.namespaces = namespaces;
        createDebug.names = [];
        createDebug.skips = [];
        const split = (typeof namespaces === 'string' ? namespaces : '')
            .trim()
            .replace(' ', ',')
            .split(',')
            .filter(Boolean);
        for (const ns of split) {
            if (ns[0] === '-') {
                createDebug.skips.push(ns.slice(1));
            }
            else {
                createDebug.names.push(ns);
            }
        }
    }
    /**
     * Checks if the given string matches a namespace template, honoring
     * asterisks as wildcards.
     *
     * @param {String} search
     * @param {String} template
     * @return {Boolean}
     */
    function matchesTemplate(search, template) {
        let searchIndex = 0;
        let templateIndex = 0;
        let starIndex = -1;
        let matchIndex = 0;
        while (searchIndex < search.length) {
            if (templateIndex < template.length && (template[templateIndex] === search[searchIndex] || template[templateIndex] === '*')) {
                // Match character or proceed with wildcard
                if (template[templateIndex] === '*') {
                    starIndex = templateIndex;
                    matchIndex = searchIndex;
                    templateIndex++; // Skip the '*'
                }
                else {
                    searchIndex++;
                    templateIndex++;
                }
            }
            else if (starIndex !== -1) { // eslint-disable-line no-negated-condition
                // Backtrack to the last '*' and try to match more characters
                templateIndex = starIndex + 1;
                matchIndex++;
                searchIndex = matchIndex;
            }
            else {
                return false; // No match
            }
        }
        // Handle trailing '*' in template
        while (templateIndex < template.length && template[templateIndex] === '*') {
            templateIndex++;
        }
        return templateIndex === template.length;
    }
    /**
    * Disable debug output.
    *
    * @return {String} namespaces
    * @api public
    */
    function disable() {
        const namespaces = [
            ...createDebug.names,
            ...createDebug.skips.map(namespace => '-' + namespace)
        ].join(',');
        createDebug.enable('');
        return namespaces;
    }
    /**
    * Returns true if the given mode name is enabled, false otherwise.
    *
    * @param {String} name
    * @return {Boolean}
    * @api public
    */
    function enabled(name) {
        for (const skip of createDebug.skips) {
            if (matchesTemplate(name, skip)) {
                return false;
            }
        }
        for (const ns of createDebug.names) {
            if (matchesTemplate(name, ns)) {
                return true;
            }
        }
        return false;
    }
    /**
    * Coerce `val`.
    *
    * @param {Mixed} val
    * @return {Mixed}
    * @api private
    */
    function coerce(val) {
        if (val instanceof Error) {
            return val.stack || val.message;
        }
        return val;
    }
    /**
    * XXX DO NOT USE. This is a temporary stub function.
    * XXX It WILL be removed in the next major release.
    */
    function destroy() {
        console.warn('Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
    }
    createDebug.enable(createDebug.load());
    return createDebug;
}
module.exports = setup;


/***/ }),

/***/ 5230:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Companion = void 0;
exports.parseRange = parseRange;
const url = __importStar(__webpack_require__(7016));
const Codec_1 = __webpack_require__(3196);
const Logger_1 = __webpack_require__(1943);
const logger = new Logger_1.Logger('Companion', Logger_1.LoggerType.BACKEND);
// FCompanion (protocol v4): senders serve media over their own FCast connection, referenced as
// `fcomp://<provider-id>.fcast/<resource-id>`. The TV's player can't open those, so they're
// rewritten to this service's local HTTP port, where a bridge turns HTTP (range) requests into
// `CompanionResourceRequest`s to whichever connection owns the provider id. That needn't be the
// connection that loaded the media: the spec requires cross-connection use to work.
const FCOMP_URL = /^fcomp:\/\/(\d+)\.fcast\/(\d+)$/i;
const BRIDGE_PATH = /^\/fcomp\/(\d+)\/(\d+)$/;
const MAX_PROVIDER_ID = 0xffff;
// Reads in flight per HTTP response when the resource size is known. Each read is one round trip
// over the sender's connection, so a few in parallel keep the pipe full.
const READ_AHEAD = 4;
// Parses a single `bytes=` range. Returns null to serve the whole resource (no or unusable
// header), or 'unsatisfiable'.
function parseRange(header, size) {
    const match = header ? /^bytes=(\d*)-(\d*)$/.exec(header.trim()) : null;
    if (!match || (match[1] === '' && match[2] === '')) {
        return null;
    }
    let start;
    let end;
    if (match[1] === '') {
        // Suffix range: the last N bytes.
        if (size === null) {
            return null;
        }
        const length = Number(match[2]);
        if (length === 0) {
            return 'unsatisfiable';
        }
        start = Math.max(0, size - length);
        end = size - 1;
    }
    else {
        start = Number(match[1]);
        end = match[2] === '' ? null : Number(match[2]);
        if (end !== null && end < start) {
            return null;
        }
    }
    if (size !== null) {
        if (start >= size) {
            return 'unsatisfiable';
        }
        end = end === null ? size - 1 : Math.min(end, size - 1);
    }
    return { start: start, end: end };
}
class Companion {
    constructor(getSession, bridgeBase) {
        this.getSession = getSession;
        this.bridgeBase = bridgeBase;
        // provider id -> session id
        this.providers = new Map();
        this.nextProviderId = 0;
        this.infoCache = new Map();
        this.route = (req, res) => {
            const path = url.parse(req.url || '').pathname || '';
            const match = BRIDGE_PATH.exec(path);
            if (!match) {
                return false;
            }
            const provider = Number(match[1]);
            const resource = Number(match[2]);
            const session = this.providerSession(provider);
            if (!session) {
                logger.warn(`Request for resource ${resource} of unknown provider ${provider}`);
                res.writeHead(404);
                res.end();
                return true;
            }
            this.serve(session, provider, resource, req, res).catch((e) => {
                logger.warn(`Serving companion resource ${provider}/${resource} failed`, e);
                if (!res.headersSent) {
                    res.writeHead(502);
                }
                res.end();
            });
            return true;
        };
    }
    // Answers a sender's `CompanionHelloRequest`: one provider id per connection.
    register(sessionId) {
        for (const [id, owner] of this.providers) {
            if (owner === sessionId) {
                return id;
            }
        }
        if (this.providers.size > MAX_PROVIDER_ID) {
            throw new Error('no free companion provider ids');
        }
        while (this.providers.has(this.nextProviderId)) {
            this.nextProviderId = (this.nextProviderId + 1) & MAX_PROVIDER_ID;
        }
        const id = this.nextProviderId;
        this.nextProviderId = (this.nextProviderId + 1) & MAX_PROVIDER_ID;
        this.providers.set(id, sessionId);
        logger.info(`Session ${sessionId} is companion provider ${id}`);
        return id;
    }
    unregister(sessionId) {
        for (const [id, owner] of [...this.providers]) {
            if (owner === sessionId) {
                this.providers.delete(id);
                for (const key of [...this.infoCache.keys()]) {
                    if (key.startsWith(`${id}/`)) {
                        this.infoCache.delete(key);
                    }
                }
            }
        }
    }
    // `fcomp://P.fcast/R` becomes the bridge URL; anything else is returned unchanged.
    rewriteUrl(value) {
        const match = typeof value === 'string' ? FCOMP_URL.exec(value) : null;
        return match ? `${this.bridgeBase()}/fcomp/${Number(match[1])}/${Number(match[2])}` : value;
    }
    static isCompanionUrl(value) {
        return typeof value === 'string' && FCOMP_URL.test(value);
    }
    providerSession(provider) {
        const sessionId = this.providers.get(provider);
        const session = sessionId !== undefined ? this.getSession(sessionId) : undefined;
        return session && session.isV4 ? session : null;
    }
    resourceInfo(session, provider, resource) {
        const key = `${provider}/${resource}`;
        let info = this.infoCache.get(key);
        if (!info) {
            info = session.companionResourceInfo(resource);
            info.catch(() => this.infoCache.delete(key));
            this.infoCache.set(key, info);
        }
        return info;
    }
    async serve(session, provider, resource, req, res) {
        let closed = false;
        req.on('close', () => { closed = true; });
        const info = await this.resourceInfo(session, provider, resource);
        const size = info.size;
        const range = parseRange(req.headers.range, size);
        if (range === 'unsatisfiable') {
            res.writeHead(416, size !== null ? { 'Content-Range': `bytes */${size}` } : {});
            res.end();
            return;
        }
        const start = range ? range.start : 0;
        const end = range ? range.end : (size !== null ? size - 1 : null);
        const headers = { 'Content-Type': info.contentType || 'application/octet-stream' };
        if (size !== null) {
            headers['Accept-Ranges'] = 'bytes';
        }
        if (size === 0 || (end !== null && end < start)) {
            headers['Content-Length'] = 0;
            res.writeHead(200, headers);
            res.end();
            return;
        }
        if (req.method === 'HEAD') {
            if (size !== null) {
                headers['Content-Length'] = end - start + 1;
                if (range) {
                    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
                }
            }
            res.writeHead(range && size !== null ? 206 : 200, headers);
            res.end();
            return;
        }
        const chunkEnd = (from) => end === null ? from + Codec_1.MAX_RESOURCE_READ_SIZE - 1 : Math.min(end, from + Codec_1.MAX_RESOURCE_READ_SIZE - 1);
        // Reads are issued ahead of time but written in order. With an unknown size, reads past
        // the end would be wasted, so they're issued one at a time.
        const pending = [];
        let next = start;
        const fill = () => {
            while (pending.length < (end === null ? 1 : READ_AHEAD) && (end === null || next <= end)) {
                const from = next;
                const to = chunkEnd(from);
                const data = session.companionRead(resource, from, to);
                // Handled when its turn comes; don't let an early rejection go unhandled.
                data.catch(() => undefined);
                pending.push({ from: from, to: to, data: data });
                next = to + 1;
            }
        };
        fill();
        const first = pending.shift();
        const firstData = await first.data;
        if (firstData === null) {
            res.writeHead(404);
            res.end();
            return;
        }
        if (size !== null) {
            headers['Content-Length'] = end - start + 1;
            if (range) {
                headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
            }
            res.writeHead(range ? 206 : 200, headers);
        }
        else if (range && start > 0) {
            // Without a total the only honest partial response is the bytes we have.
            res.writeHead(206, { ...headers, 'Content-Range': `bytes ${start}-${start + firstData.length - 1}/*`, 'Content-Length': firstData.length });
            res.end(firstData);
            return;
        }
        else {
            res.writeHead(200, headers);
        }
        let chunk = { from: first.from, to: first.to, data: firstData };
        for (;;) {
            if (closed) {
                return;
            }
            if (chunk.data.length > 0 && !res.write(chunk.data)) {
                await new Promise((resolve) => {
                    res.once('drain', resolve);
                    res.once('close', resolve);
                });
            }
            // A short read is the end of the resource.
            if (chunk.data.length < chunk.to - chunk.from + 1) {
                break;
            }
            fill();
            const nextRead = pending.shift();
            if (!nextRead) {
                break;
            }
            const data = await nextRead.data;
            if (data === null || data.length === 0) {
                break;
            }
            chunk = { from: nextRead.from, to: nextRead.to, data: data };
        }
        res.end();
    }
}
exports.Companion = Companion;


/***/ }),

/***/ 5257:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.printTree = void 0;
const printTree = (tab = '', children) => {
    let str = '';
    let last = children.length - 1;
    for (; last >= 0; last--)
        if (children[last])
            break;
    for (let i = 0; i <= last; i++) {
        const fn = children[i];
        if (!fn)
            continue;
        const isLast = i === last;
        const child = fn(tab + (isLast ? ' ' : '│') + '  ');
        const branch = child ? (isLast ? '└─' : '├─') : '│';
        str += '\n' + tab + branch + (child ? ' ' + child : '');
    }
    return str;
};
exports.printTree = printTree;


/***/ }),

/***/ 5312:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.DeviceInfo = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class DeviceInfo {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsDeviceInfo(bb, obj) {
        return (obj || new DeviceInfo()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsDeviceInfo(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new DeviceInfo()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    displayName(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    appName(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    appVersion(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 8);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    static startDeviceInfo(builder) {
        builder.startObject(3);
    }
    static addDisplayName(builder, displayNameOffset) {
        builder.addFieldOffset(0, displayNameOffset, 0);
    }
    static addAppName(builder, appNameOffset) {
        builder.addFieldOffset(1, appNameOffset, 0);
    }
    static addAppVersion(builder, appVersionOffset) {
        builder.addFieldOffset(2, appVersionOffset, 0);
    }
    static endDeviceInfo(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createDeviceInfo(builder, displayNameOffset, appNameOffset, appVersionOffset) {
        DeviceInfo.startDeviceInfo(builder);
        DeviceInfo.addDisplayName(builder, displayNameOffset);
        DeviceInfo.addAppName(builder, appNameOffset);
        DeviceInfo.addAppVersion(builder, appVersionOffset);
        return DeviceInfo.endDeviceInfo(builder);
    }
}
exports.DeviceInfo = DeviceInfo;


/***/ }),

/***/ 5343:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

exports.toString = function (klass) {
    switch (klass) {
        case 1: return 'IN';
        case 2: return 'CS';
        case 3: return 'CH';
        case 4: return 'HS';
        case 255: return 'ANY';
    }
    return 'UNKNOWN_' + klass;
};
exports.toClass = function (name) {
    switch (name.toUpperCase()) {
        case 'IN': return 1;
        case 'CS': return 2;
        case 'CH': return 3;
        case 'HS': return 4;
        case 'ANY': return 255;
    }
    return 0;
};


/***/ }),

/***/ 5379:
/***/ ((module, __unused_webpack_exports, __webpack_require__) => {

"use strict";

const os = __webpack_require__(857);
const tty = __webpack_require__(2018);
const hasFlag = __webpack_require__(9344);
const { env } = process;
let forceColor;
if (hasFlag('no-color') ||
    hasFlag('no-colors') ||
    hasFlag('color=false') ||
    hasFlag('color=never')) {
    forceColor = 0;
}
else if (hasFlag('color') ||
    hasFlag('colors') ||
    hasFlag('color=true') ||
    hasFlag('color=always')) {
    forceColor = 1;
}
if ('FORCE_COLOR' in env) {
    if (env.FORCE_COLOR === 'true') {
        forceColor = 1;
    }
    else if (env.FORCE_COLOR === 'false') {
        forceColor = 0;
    }
    else {
        forceColor = env.FORCE_COLOR.length === 0 ? 1 : Math.min(parseInt(env.FORCE_COLOR, 10), 3);
    }
}
function translateLevel(level) {
    if (level === 0) {
        return false;
    }
    return {
        level,
        hasBasic: true,
        has256: level >= 2,
        has16m: level >= 3
    };
}
function supportsColor(haveStream, streamIsTTY) {
    if (forceColor === 0) {
        return 0;
    }
    if (hasFlag('color=16m') ||
        hasFlag('color=full') ||
        hasFlag('color=truecolor')) {
        return 3;
    }
    if (hasFlag('color=256')) {
        return 2;
    }
    if (haveStream && !streamIsTTY && forceColor === undefined) {
        return 0;
    }
    const min = forceColor || 0;
    if (env.TERM === 'dumb') {
        return min;
    }
    if (process.platform === 'win32') {
        // Windows 10 build 10586 is the first Windows release that supports 256 colors.
        // Windows 10 build 14931 is the first release that supports 16m/TrueColor.
        const osRelease = os.release().split('.');
        if (Number(osRelease[0]) >= 10 &&
            Number(osRelease[2]) >= 10586) {
            return Number(osRelease[2]) >= 14931 ? 3 : 2;
        }
        return 1;
    }
    if ('CI' in env) {
        if (['TRAVIS', 'CIRCLECI', 'APPVEYOR', 'GITLAB_CI', 'GITHUB_ACTIONS', 'BUILDKITE'].some(sign => sign in env) || env.CI_NAME === 'codeship') {
            return 1;
        }
        return min;
    }
    if ('TEAMCITY_VERSION' in env) {
        return /^(9\.(0*[1-9]\d*)\.|\d{2,}\.)/.test(env.TEAMCITY_VERSION) ? 1 : 0;
    }
    if (env.COLORTERM === 'truecolor') {
        return 3;
    }
    if ('TERM_PROGRAM' in env) {
        const version = parseInt((env.TERM_PROGRAM_VERSION || '').split('.')[0], 10);
        switch (env.TERM_PROGRAM) {
            case 'iTerm.app':
                return version >= 3 ? 3 : 2;
            case 'Apple_Terminal':
                return 2;
            // No default
        }
    }
    if (/-256(color)?$/i.test(env.TERM)) {
        return 2;
    }
    if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(env.TERM)) {
        return 1;
    }
    if ('COLORTERM' in env) {
        return 1;
    }
    return min;
}
function getSupportLevel(stream) {
    const level = supportsColor(stream, stream && stream.isTTY);
    return translateLevel(level);
}
module.exports = {
    supportsColor: getSupportLevel,
    stdout: translateLevel(supportsColor(true, tty.isatty(1))),
    stderr: translateLevel(supportsColor(true, tty.isatty(2)))
};


/***/ }),

/***/ 5402:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ErrorKind = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
var ErrorKind;
(function (ErrorKind) {
    ErrorKind[ErrorKind["InvalidOpcode"] = 0] = "InvalidOpcode";
    ErrorKind[ErrorKind["ResourceNotFound"] = 1] = "ResourceNotFound";
    ErrorKind[ErrorKind["SeekOutOfRange"] = 2] = "SeekOutOfRange";
    ErrorKind[ErrorKind["VolumeOutOfRange"] = 3] = "VolumeOutOfRange";
    ErrorKind[ErrorKind["RateOutOfRange"] = 4] = "RateOutOfRange";
    ErrorKind[ErrorKind["UnsupportedFormat"] = 5] = "UnsupportedFormat";
    ErrorKind[ErrorKind["MalformedBody"] = 6] = "MalformedBody";
    ErrorKind[ErrorKind["InvalidState"] = 7] = "InvalidState";
    ErrorKind[ErrorKind["QueuePositionOutOfRange"] = 8] = "QueuePositionOutOfRange";
    ErrorKind[ErrorKind["QueueRemovePlayingItem"] = 9] = "QueueRemovePlayingItem";
    ErrorKind[ErrorKind["QueueFull"] = 10] = "QueueFull";
    ErrorKind[ErrorKind["InvalidPayloadType"] = 11] = "InvalidPayloadType";
    ErrorKind[ErrorKind["Internal"] = 12] = "Internal";
})(ErrorKind || (exports.ErrorKind = ErrorKind = {}));


/***/ }),

/***/ 5537:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.toTreeSync = void 0;
const tree_dump_1 = __webpack_require__(8930);
const util_1 = __webpack_require__(6747);
const toTreeSync = (fs, opts = {}) => {
    var _a;
    const separator = opts.separator || '/';
    let dir = opts.dir || separator;
    if (dir[dir.length - 1] !== separator)
        dir += separator;
    const tab = opts.tab || '';
    const depth = (_a = opts.depth) !== null && _a !== void 0 ? _a : 10;
    let subtree = ' (...)';
    if (depth > 0) {
        const list = fs.readdirSync(dir, { withFileTypes: true });
        subtree = (0, tree_dump_1.printTree)(tab, list.map(entry => tab => {
            if (entry.isDirectory()) {
                return (0, exports.toTreeSync)(fs, { dir: dir + entry.name, depth: depth - 1, tab });
            }
            else if (entry.isSymbolicLink()) {
                return '' + entry.name + ' → ' + fs.readlinkSync(dir + entry.name);
            }
            else {
                return '' + entry.name;
            }
        }));
    }
    const base = (0, util_1.basename)(dir, separator) + separator;
    return base + subtree;
};
exports.toTreeSync = toTreeSync;


/***/ }),

/***/ 5552:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.getWriteFileOptions = exports.writeFileDefaults = exports.getRealpathOptsAndCb = exports.getRealpathOptions = exports.getStatOptsAndCb = exports.getStatOptions = exports.getAppendFileOptsAndCb = exports.getAppendFileOpts = exports.getOpendirOptsAndCb = exports.getOpendirOptions = exports.getReaddirOptsAndCb = exports.getReaddirOptions = exports.getReadFileOptions = exports.getRmOptsAndCb = exports.getRmdirOptions = exports.getDefaultOptsAndCb = exports.getDefaultOpts = exports.optsDefaults = exports.getMkdirOptions = void 0;
exports.getOptions = getOptions;
exports.optsGenerator = optsGenerator;
exports.optsAndCbGenerator = optsAndCbGenerator;
const constants_1 = __webpack_require__(1983);
const encoding_1 = __webpack_require__(2708);
const util_1 = __webpack_require__(4784);
const mkdirDefaults = {
    mode: 511 /* MODE.DIR */,
    recursive: false,
};
const getMkdirOptions = (options) => {
    if (typeof options === 'number')
        return Object.assign({}, mkdirDefaults, { mode: options });
    return Object.assign({}, mkdirDefaults, options);
};
exports.getMkdirOptions = getMkdirOptions;
const ERRSTR_OPTS = tipeof => `Expected options to be either an object or a string, but got ${tipeof} instead`;
function getOptions(defaults, options) {
    let opts;
    if (!options)
        return defaults;
    else {
        const tipeof = typeof options;
        switch (tipeof) {
            case 'string':
                opts = Object.assign({}, defaults, { encoding: options });
                break;
            case 'object':
                opts = Object.assign({}, defaults, options);
                break;
            default:
                throw TypeError(ERRSTR_OPTS(tipeof));
        }
    }
    if (opts.encoding !== 'buffer')
        (0, encoding_1.assertEncoding)(opts.encoding);
    return opts;
}
function optsGenerator(defaults) {
    return options => getOptions(defaults, options);
}
function optsAndCbGenerator(getOpts) {
    return (options, callback) => typeof options === 'function' ? [getOpts(), options] : [getOpts(options), (0, util_1.validateCallback)(callback)];
}
exports.optsDefaults = {
    encoding: 'utf8',
};
exports.getDefaultOpts = optsGenerator(exports.optsDefaults);
exports.getDefaultOptsAndCb = optsAndCbGenerator(exports.getDefaultOpts);
const rmdirDefaults = {
    recursive: false,
};
const getRmdirOptions = (options) => {
    return Object.assign({}, rmdirDefaults, options);
};
exports.getRmdirOptions = getRmdirOptions;
const getRmOpts = optsGenerator(exports.optsDefaults);
exports.getRmOptsAndCb = optsAndCbGenerator(getRmOpts);
const readFileOptsDefaults = {
    flag: 'r',
};
exports.getReadFileOptions = optsGenerator(readFileOptsDefaults);
const readdirDefaults = {
    encoding: 'utf8',
    recursive: false,
    withFileTypes: false,
};
exports.getReaddirOptions = optsGenerator(readdirDefaults);
exports.getReaddirOptsAndCb = optsAndCbGenerator(exports.getReaddirOptions);
const opendirDefaults = {
    encoding: 'utf8',
    bufferSize: 32,
    recursive: false,
};
exports.getOpendirOptions = optsGenerator(opendirDefaults);
exports.getOpendirOptsAndCb = optsAndCbGenerator(exports.getOpendirOptions);
const appendFileDefaults = {
    encoding: 'utf8',
    mode: 438 /* MODE.DEFAULT */,
    flag: constants_1.FLAGS[constants_1.FLAGS.a],
};
exports.getAppendFileOpts = optsGenerator(appendFileDefaults);
exports.getAppendFileOptsAndCb = optsAndCbGenerator(exports.getAppendFileOpts);
const statDefaults = {
    bigint: false,
};
const getStatOptions = (options = {}) => Object.assign({}, statDefaults, options);
exports.getStatOptions = getStatOptions;
const getStatOptsAndCb = (options, callback) => typeof options === 'function' ? [(0, exports.getStatOptions)(), options] : [(0, exports.getStatOptions)(options), (0, util_1.validateCallback)(callback)];
exports.getStatOptsAndCb = getStatOptsAndCb;
const realpathDefaults = exports.optsDefaults;
exports.getRealpathOptions = optsGenerator(realpathDefaults);
exports.getRealpathOptsAndCb = optsAndCbGenerator(exports.getRealpathOptions);
exports.writeFileDefaults = {
    encoding: 'utf8',
    mode: 438 /* MODE.DEFAULT */,
    flag: constants_1.FLAGS[constants_1.FLAGS.w],
};
exports.getWriteFileOptions = optsGenerator(exports.writeFileDefaults);


/***/ }),

/***/ 5692:
/***/ ((module) => {

"use strict";
module.exports = require("https");

/***/ }),

/***/ 5693:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.TcpListenerService = void 0;
const net = __importStar(__webpack_require__(9278));
const tls = __importStar(__webpack_require__(4756));
const ListenerService_1 = __webpack_require__(8460);
const FCastSession_1 = __webpack_require__(9108);
const Logger_1 = __webpack_require__(1943);
const logger = new Logger_1.Logger('TcpListenerService', Logger_1.LoggerType.BACKEND);
const TLS_UPGRADE_TIMEOUT_MS = 10000;
class TcpListenerService extends ListenerService_1.ListenerService {
    // Pass a V4Config to offer protocol v4 (TLS 1.3 + FlatBuffers); without one, sessions
    // negotiate v3 at most.
    constructor(v4Config = null) {
        super();
        this.v4Config = v4Config;
    }
    start(port = TcpListenerService.PORT) {
        if (this.server != null) {
            return;
        }
        this.server = net.createServer()
            .listen(port)
            .on("connection", this.handleConnection.bind(this))
            .on("error", this.handleServerError.bind(this));
    }
    stop() {
        if (this.server == null) {
            return;
        }
        const server = this.server;
        this.server = null;
        // close() only stops accepting; the senders' connections would keep the server alive.
        server.close();
        this.sessionMap.forEach((session) => session.socket.destroy());
    }
    // The bound port, or null before listening (tests start on port 0).
    get port() {
        const address = this.server ? this.server.address() : null;
        return address && typeof address === 'object' ? address.port : null;
    }
    disconnect(sessionId) {
        var _a;
        (_a = this.sessionMap.get(sessionId)) === null || _a === void 0 ? void 0 : _a.socket.destroy();
        this.sessionMap.delete(sessionId);
    }
    getSenders() {
        const senders = [];
        this.sessionMap.forEach((sender) => { senders.push(sender.remoteAddress); });
        return senders;
    }
    handleConnection(socket) {
        logger.info(`New connection from ${socket.remoteAddress}:${socket.remotePort}`);
        const address = socket.remoteAddress;
        const port = socket.remotePort;
        const session = new FCastSession_1.FCastSession(socket, (data) => socket.write(data), this.v4Config);
        session.remoteAddress = address;
        session.bindEvents(this.emitter);
        this.sessionMap.set(session.sessionId, session);
        const onData = (buffer) => {
            try {
                session.processBytes(buffer);
            }
            catch (e) {
                logger.warn(`Error while handling packet from ${address}:${port}.`, e);
                socket.destroy();
            }
        };
        // After a TLS upgrade either socket may report the close, so clean up once.
        let closed = false;
        const onClose = () => {
            if (closed) {
                return;
            }
            closed = true;
            session.closed();
            this.sessionMap.delete(session.sessionId);
            this.emitter.emit('disconnect', { sessionId: session.sessionId, type: 'tcp', data: { address: address, port: port } });
        };
        if (this.v4Config !== null) {
            session.onUpgradeRequest = (prefix) => {
                socket.removeListener("data", onData);
                this.upgradeToTls(session, socket, prefix, onClose);
            };
        }
        socket.on("error", (err) => {
            logger.warn(`Error from ${address}:${port}.`, err);
            this.disconnect(session.sessionId);
        });
        socket.on("data", onData);
        socket.on("close", onClose);
        this.emitter.emit('connect', { sessionId: session.sessionId, type: 'tcp', data: { address: address, port: port } });
        try {
            logger.info('Sending version');
            session.sendVersion();
        }
        catch (e) {
            logger.info('Failed to send version', e);
        }
    }
    // Upgrades the connection to TLS in place, as protocol v4 requires. `prefix` holds bytes that
    // were read past the sender's `Version` packet: the start of its TLS ClientHello.
    upgradeToTls(session, socket, prefix, onClose) {
        // Pause before unshifting so the prefix is buffered rather than emitted to no listener.
        // TLSSocket feeds any buffered data to the handshake when it starts reading.
        socket.pause();
        if (prefix.length > 0) {
            socket.unshift(prefix);
        }
        const tlsSocket = new tls.TLSSocket(socket, {
            isServer: true,
            secureContext: this.v4Config.identity.secureContext,
            requestCert: false,
        });
        const timeout = setTimeout(() => {
            logger.warn(`TLS upgrade of session ${session.sessionId} timed out`);
            tlsSocket.destroy();
        }, TLS_UPGRADE_TIMEOUT_MS);
        tlsSocket.on("error", (err) => {
            clearTimeout(timeout);
            logger.warn(`TLS error in session ${session.sessionId}.`, err);
            socket.destroy();
        });
        tlsSocket.on("close", () => {
            clearTimeout(timeout);
            onClose();
        });
        tlsSocket.once("secure", () => {
            clearTimeout(timeout);
            tlsSocket.on("data", (buffer) => {
                try {
                    session.processBytes(buffer);
                }
                catch (e) {
                    logger.warn(`Error while handling packet in session ${session.sessionId}.`, e);
                    tlsSocket.destroy();
                }
            });
            try {
                session.completeV4Upgrade(tlsSocket, (data) => tlsSocket.write(data));
            }
            catch (e) {
                logger.warn(`Failed to start v4 session ${session.sessionId}.`, e);
                tlsSocket.destroy();
            }
        });
    }
}
exports.TcpListenerService = TcpListenerService;
TcpListenerService.PORT = 46899;


/***/ }),

/***/ 5765:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SenderIntroduction = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const device_info_1 = __webpack_require__(5312);
class SenderIntroduction {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsSenderIntroduction(bb, obj) {
        return (obj || new SenderIntroduction()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsSenderIntroduction(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new SenderIntroduction()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    deviceInfo(obj) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? (obj || new device_info_1.DeviceInfo()).__init(this.bb.__indirect(this.bb_pos + offset), this.bb) : null;
    }
    static startSenderIntroduction(builder) {
        builder.startObject(1);
    }
    static addDeviceInfo(builder, deviceInfoOffset) {
        builder.addFieldOffset(0, deviceInfoOffset, 0);
    }
    static endSenderIntroduction(builder) {
        const offset = builder.endObject();
        builder.requiredField(offset, 4); // device_info
        return offset;
    }
    static createSenderIntroduction(builder, deviceInfoOffset) {
        SenderIntroduction.startSenderIntroduction(builder);
        SenderIntroduction.addDeviceInfo(builder, deviceInfoOffset);
        return SenderIntroduction.endSenderIntroduction(builder);
    }
}
exports.SenderIntroduction = SenderIntroduction;


/***/ }),

/***/ 5965:
/***/ ((module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.memfs = exports.fs = exports.vol = exports.Volume = void 0;
exports.createFsFromVolume = createFsFromVolume;
const Stats_1 = __webpack_require__(4054);
const Dirent_1 = __webpack_require__(1093);
const volume_1 = __webpack_require__(6951);
Object.defineProperty(exports, "Volume", ({ enumerable: true, get: function () { return volume_1.Volume; } }));
const constants_1 = __webpack_require__(2612);
const fsSynchronousApiList_1 = __webpack_require__(8198);
const fsCallbackApiList_1 = __webpack_require__(231);
const { F_OK, R_OK, W_OK, X_OK } = constants_1.constants;
// Default volume.
exports.vol = new volume_1.Volume();
function createFsFromVolume(vol) {
    const fs = { F_OK, R_OK, W_OK, X_OK, constants: constants_1.constants, Stats: Stats_1.default, Dirent: Dirent_1.default };
    // Bind FS methods.
    for (const method of fsSynchronousApiList_1.fsSynchronousApiList)
        if (typeof vol[method] === 'function')
            fs[method] = vol[method].bind(vol);
    for (const method of fsCallbackApiList_1.fsCallbackApiList)
        if (typeof vol[method] === 'function')
            fs[method] = vol[method].bind(vol);
    fs.StatWatcher = vol.StatWatcher;
    fs.FSWatcher = vol.FSWatcher;
    fs.WriteStream = vol.WriteStream;
    fs.ReadStream = vol.ReadStream;
    fs.promises = vol.promises;
    fs._toUnixTimestamp = volume_1.toUnixTimestamp;
    fs.__vol = vol;
    return fs;
}
exports.fs = createFsFromVolume(exports.vol);
/**
 * Creates a new file system instance.
 *
 * @param json File system structure expressed as a JSON object.
 *        Use `null` for empty directories and empty string for empty files.
 * @param cwd Current working directory. The JSON structure will be created
 *        relative to this path.
 * @returns A `memfs` file system instance, which is a drop-in replacement for
 *          the `fs` module.
 */
const memfs = (json = {}, cwd = '/') => {
    const vol = volume_1.Volume.fromNestedJSON(json, cwd);
    const fs = createFsFromVolume(vol);
    return { fs, vol };
};
exports.memfs = memfs;
module.exports = Object.assign(Object.assign({}, module.exports), exports.fs);
module.exports.semantic = true;


/***/ }),

/***/ 5976:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

// Here we mock the global `process` variable in case we are not in Node's environment.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.createProcess = createProcess;
/**
 * Looks to return a `process` object, if one is available.
 *
 * The global `process` is returned if defined;
 * otherwise `require('process')` is attempted.
 *
 * If that fails, `undefined` is returned.
 *
 * @return {IProcess | undefined}
 */
const maybeReturnProcess = () => {
    if (typeof process !== 'undefined') {
        return process;
    }
    try {
        return __webpack_require__(932);
    }
    catch (_a) {
        return undefined;
    }
};
function createProcess() {
    const p = maybeReturnProcess() || {};
    if (!p.cwd)
        p.cwd = () => '/';
    if (!p.emitWarning)
        p.emitWarning = (message, type) => {
            // tslint:disable-next-line:no-console
            console.warn(`${type}${type ? ': ' : ''}${message}`);
        };
    if (!p.env)
        p.env = {};
    return p;
}
exports["default"] = createProcess();


/***/ }),

/***/ 6004:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Time = void 0;
class Time {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    micros() {
        return this.bb.readUint64(this.bb_pos);
    }
    static sizeOf() {
        return 8;
    }
    static createTime(builder, micros) {
        builder.prep(8, 8);
        builder.writeInt64(BigInt(micros !== null && micros !== void 0 ? micros : 0));
        return builder.offset();
    }
}
exports.Time = Time;


/***/ }),

/***/ 6073:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FsPromises = void 0;
const util_1 = __webpack_require__(4784);
const constants_1 = __webpack_require__(2612);
class FsPromises {
    constructor(fs, FileHandle) {
        this.fs = fs;
        this.FileHandle = FileHandle;
        this.constants = constants_1.constants;
        this.cp = (0, util_1.promisify)(this.fs, 'cp');
        this.opendir = (0, util_1.promisify)(this.fs, 'opendir');
        this.statfs = (0, util_1.promisify)(this.fs, 'statfs');
        this.lutimes = (0, util_1.promisify)(this.fs, 'lutimes');
        this.access = (0, util_1.promisify)(this.fs, 'access');
        this.chmod = (0, util_1.promisify)(this.fs, 'chmod');
        this.chown = (0, util_1.promisify)(this.fs, 'chown');
        this.copyFile = (0, util_1.promisify)(this.fs, 'copyFile');
        this.lchmod = (0, util_1.promisify)(this.fs, 'lchmod');
        this.lchown = (0, util_1.promisify)(this.fs, 'lchown');
        this.link = (0, util_1.promisify)(this.fs, 'link');
        this.lstat = (0, util_1.promisify)(this.fs, 'lstat');
        this.mkdir = (0, util_1.promisify)(this.fs, 'mkdir');
        this.mkdtemp = (0, util_1.promisify)(this.fs, 'mkdtemp');
        this.readdir = (0, util_1.promisify)(this.fs, 'readdir');
        this.readlink = (0, util_1.promisify)(this.fs, 'readlink');
        this.realpath = (0, util_1.promisify)(this.fs, 'realpath');
        this.rename = (0, util_1.promisify)(this.fs, 'rename');
        this.rmdir = (0, util_1.promisify)(this.fs, 'rmdir');
        this.rm = (0, util_1.promisify)(this.fs, 'rm');
        this.stat = (0, util_1.promisify)(this.fs, 'stat');
        this.symlink = (0, util_1.promisify)(this.fs, 'symlink');
        this.truncate = (0, util_1.promisify)(this.fs, 'truncate');
        this.unlink = (0, util_1.promisify)(this.fs, 'unlink');
        this.utimes = (0, util_1.promisify)(this.fs, 'utimes');
        this.readFile = (id, options) => {
            return (0, util_1.promisify)(this.fs, 'readFile')(id instanceof this.FileHandle ? id.fd : id, options);
        };
        this.appendFile = (path, data, options) => {
            return (0, util_1.promisify)(this.fs, 'appendFile')(path instanceof this.FileHandle ? path.fd : path, data, options);
        };
        this.open = (path, flags = 'r', mode) => {
            return (0, util_1.promisify)(this.fs, 'open', fd => new this.FileHandle(this.fs, fd))(path, flags, mode);
        };
        this.writeFile = (id, data, options) => {
            const dataPromise = (0, util_1.isReadableStream)(data) ? (0, util_1.streamToBuffer)(data) : Promise.resolve(data);
            return dataPromise.then(data => (0, util_1.promisify)(this.fs, 'writeFile')(id instanceof this.FileHandle ? id.fd : id, data, options));
        };
        this.watch = () => {
            throw new Error('Not implemented');
        };
    }
}
exports.FsPromises = FsPromises;


/***/ }),

/***/ 6181:
/***/ ((module, exports, __webpack_require__) => {

/**
 * Module dependencies.
 */
const tty = __webpack_require__(2018);
const util = __webpack_require__(9023);
/**
 * This is the Node.js implementation of `debug()`.
 */
exports.init = init;
exports.log = log;
exports.formatArgs = formatArgs;
exports.save = save;
exports.load = load;
exports.useColors = useColors;
exports.destroy = util.deprecate(() => { }, 'Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.');
/**
 * Colors.
 */
exports.colors = [6, 2, 3, 4, 5, 1];
try {
    // Optional dependency (as in, doesn't need to be installed, NOT like optionalDependencies in package.json)
    // eslint-disable-next-line import/no-extraneous-dependencies
    const supportsColor = __webpack_require__(5379);
    if (supportsColor && (supportsColor.stderr || supportsColor).level >= 2) {
        exports.colors = [
            20,
            21,
            26,
            27,
            32,
            33,
            38,
            39,
            40,
            41,
            42,
            43,
            44,
            45,
            56,
            57,
            62,
            63,
            68,
            69,
            74,
            75,
            76,
            77,
            78,
            79,
            80,
            81,
            92,
            93,
            98,
            99,
            112,
            113,
            128,
            129,
            134,
            135,
            148,
            149,
            160,
            161,
            162,
            163,
            164,
            165,
            166,
            167,
            168,
            169,
            170,
            171,
            172,
            173,
            178,
            179,
            184,
            185,
            196,
            197,
            198,
            199,
            200,
            201,
            202,
            203,
            204,
            205,
            206,
            207,
            208,
            209,
            214,
            215,
            220,
            221
        ];
    }
}
catch (error) {
    // Swallow - we only care if `supports-color` is available; it doesn't have to be.
}
/**
 * Build up the default `inspectOpts` object from the environment variables.
 *
 *   $ DEBUG_COLORS=no DEBUG_DEPTH=10 DEBUG_SHOW_HIDDEN=enabled node script.js
 */
exports.inspectOpts = Object.keys(process.env).filter(key => {
    return /^debug_/i.test(key);
}).reduce((obj, key) => {
    // Camel-case
    const prop = key
        .substring(6)
        .toLowerCase()
        .replace(/_([a-z])/g, (_, k) => {
        return k.toUpperCase();
    });
    // Coerce string value into JS value
    let val = process.env[key];
    if (/^(yes|on|true|enabled)$/i.test(val)) {
        val = true;
    }
    else if (/^(no|off|false|disabled)$/i.test(val)) {
        val = false;
    }
    else if (val === 'null') {
        val = null;
    }
    else {
        val = Number(val);
    }
    obj[prop] = val;
    return obj;
}, {});
/**
 * Is stdout a TTY? Colored output is enabled when `true`.
 */
function useColors() {
    return 'colors' in exports.inspectOpts ?
        Boolean(exports.inspectOpts.colors) :
        tty.isatty(process.stderr.fd);
}
/**
 * Adds ANSI color escape codes if enabled.
 *
 * @api public
 */
function formatArgs(args) {
    const { namespace: name, useColors } = this;
    if (useColors) {
        const c = this.color;
        const colorCode = '\u001B[3' + (c < 8 ? c : '8;5;' + c);
        const prefix = `  ${colorCode};1m${name} \u001B[0m`;
        args[0] = prefix + args[0].split('\n').join('\n' + prefix);
        args.push(colorCode + 'm+' + module.exports.humanize(this.diff) + '\u001B[0m');
    }
    else {
        args[0] = getDate() + name + ' ' + args[0];
    }
}
function getDate() {
    if (exports.inspectOpts.hideDate) {
        return '';
    }
    return new Date().toISOString() + ' ';
}
/**
 * Invokes `util.formatWithOptions()` with the specified arguments and writes to stderr.
 */
function log(...args) {
    return process.stderr.write(util.formatWithOptions(exports.inspectOpts, ...args) + '\n');
}
/**
 * Save `namespaces`.
 *
 * @param {String} namespaces
 * @api private
 */
function save(namespaces) {
    if (namespaces) {
        process.env.DEBUG = namespaces;
    }
    else {
        // If you set a process.env field to null or undefined, it gets cast to the
        // string 'null' or 'undefined'. Just delete instead.
        delete process.env.DEBUG;
    }
}
/**
 * Load `namespaces`.
 *
 * @return {String} returns the previously persisted debug modes
 * @api private
 */
function load() {
    return process.env.DEBUG;
}
/**
 * Init logic for `debug` instances.
 *
 * Create a new `inspectOpts` object in case `useColors` is set
 * differently for a particular `debug` instance.
 */
function init(debug) {
    debug.inspectOpts = {};
    const keys = Object.keys(exports.inspectOpts);
    for (let i = 0; i < keys.length; i++) {
        debug.inspectOpts[keys[i]] = exports.inspectOpts[keys[i]];
    }
}
module.exports = __webpack_require__(5148)(exports);
const { formatters } = module.exports;
/**
 * Map %o to `util.inspect()`, all on a single line.
 */
formatters.o = function (v) {
    this.inspectOpts.colors = this.useColors;
    return util.inspect(v, this.inspectOpts)
        .split('\n')
        .map(str => str.trim())
        .join(' ');
};
/**
 * Map %O to `util.inspect()`, allowing multiple lines if needed.
 */
formatters.O = function (v) {
    this.inspectOpts.colors = this.useColors;
    return util.inspect(v, this.inspectOpts);
};


/***/ }),

/***/ 6311:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.StopPlayback = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class StopPlayback {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsStopPlayback(bb, obj) {
        return (obj || new StopPlayback()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsStopPlayback(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new StopPlayback()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static startStopPlayback(builder) {
        builder.startObject(0);
    }
    static endStopPlayback(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createStopPlayback(builder) {
        StopPlayback.startStopPlayback(builder);
        return StopPlayback.endStopPlayback(builder);
    }
}
exports.StopPlayback = StopPlayback;


/***/ }),

/***/ 6459:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ChangeTrack = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const media_track_type_1 = __webpack_require__(1392);
class ChangeTrack {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsChangeTrack(bb, obj) {
        return (obj || new ChangeTrack()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsChangeTrack(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new ChangeTrack()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    id() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readUint32(this.bb_pos + offset) : null;
    }
    trackType() {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.readUint8(this.bb_pos + offset) : media_track_type_1.MediaTrackType.Video;
    }
    static startChangeTrack(builder) {
        builder.startObject(2);
    }
    static addId(builder, id) {
        builder.addFieldInt32(0, id, null);
    }
    static addTrackType(builder, trackType) {
        builder.addFieldInt8(1, trackType, media_track_type_1.MediaTrackType.Video);
    }
    static endChangeTrack(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createChangeTrack(builder, id, trackType) {
        ChangeTrack.startChangeTrack(builder);
        if (id !== null)
            ChangeTrack.addId(builder, id);
        ChangeTrack.addTrackType(builder, trackType);
        return ChangeTrack.endChangeTrack(builder);
    }
}
exports.ChangeTrack = ChangeTrack;


/***/ }),

/***/ 6469:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SubtitleTrackMeta = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class SubtitleTrackMeta {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsSubtitleTrackMeta(bb, obj) {
        return (obj || new SubtitleTrackMeta()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsSubtitleTrackMeta(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new SubtitleTrackMeta()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static startSubtitleTrackMeta(builder) {
        builder.startObject(0);
    }
    static endSubtitleTrackMeta(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createSubtitleTrackMeta(builder) {
        SubtitleTrackMeta.startSubtitleTrackMeta(builder);
        return SubtitleTrackMeta.endSubtitleTrackMeta(builder);
    }
}
exports.SubtitleTrackMeta = SubtitleTrackMeta;


/***/ }),

/***/ 6496:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Metadata = void 0;
exports.unionToMetadata = unionToMetadata;
exports.unionListToMetadata = unionListToMetadata;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const audio_metadata_1 = __webpack_require__(1717);
const video_metadata_1 = __webpack_require__(178);
var Metadata;
(function (Metadata) {
    Metadata[Metadata["NONE"] = 0] = "NONE";
    Metadata[Metadata["Video"] = 1] = "Video";
    Metadata[Metadata["Audio"] = 2] = "Audio";
})(Metadata || (exports.Metadata = Metadata = {}));
function unionToMetadata(type, accessor) {
    switch (Metadata[type]) {
        case 'NONE': return null;
        case 'Video': return accessor(new video_metadata_1.VideoMetadata());
        case 'Audio': return accessor(new audio_metadata_1.AudioMetadata());
        default: return null;
    }
}
function unionListToMetadata(type, accessor, index) {
    switch (Metadata[type]) {
        case 'NONE': return null;
        case 'Video': return accessor(index, new video_metadata_1.VideoMetadata());
        case 'Audio': return accessor(index, new audio_metadata_1.AudioMetadata());
        default: return null;
    }
}


/***/ }),

/***/ 6620:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.StartMirroringSession = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class StartMirroringSession {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsStartMirroringSession(bb, obj) {
        return (obj || new StartMirroringSession()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsStartMirroringSession(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new StartMirroringSession()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    sessionId() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readUint16(this.bb_pos + offset) : 0;
    }
    static startStartMirroringSession(builder) {
        builder.startObject(1);
    }
    static addSessionId(builder, sessionId) {
        builder.addFieldInt16(0, sessionId, 0);
    }
    static endStartMirroringSession(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createStartMirroringSession(builder, sessionId) {
        StartMirroringSession.startStartMirroringSession(builder);
        StartMirroringSession.addSessionId(builder, sessionId);
        return StartMirroringSession.endStartMirroringSession(builder);
    }
}
exports.StartMirroringSession = StartMirroringSession;


/***/ }),

/***/ 6712:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

/*
 * Traditional DNS header OPCODEs (4-bits) defined by IANA in
 * https://www.iana.org/assignments/dns-parameters/dns-parameters.xhtml#dns-parameters-5
 */
exports.toString = function (opcode) {
    switch (opcode) {
        case 0: return 'QUERY';
        case 1: return 'IQUERY';
        case 2: return 'STATUS';
        case 3: return 'OPCODE_3';
        case 4: return 'NOTIFY';
        case 5: return 'UPDATE';
        case 6: return 'OPCODE_6';
        case 7: return 'OPCODE_7';
        case 8: return 'OPCODE_8';
        case 9: return 'OPCODE_9';
        case 10: return 'OPCODE_10';
        case 11: return 'OPCODE_11';
        case 12: return 'OPCODE_12';
        case 13: return 'OPCODE_13';
        case 14: return 'OPCODE_14';
        case 15: return 'OPCODE_15';
    }
    return 'OPCODE_' + opcode;
};
exports.toOpcode = function (code) {
    switch (code.toUpperCase()) {
        case 'QUERY': return 0;
        case 'IQUERY': return 1;
        case 'STATUS': return 2;
        case 'OPCODE_3': return 3;
        case 'NOTIFY': return 4;
        case 'UPDATE': return 5;
        case 'OPCODE_6': return 6;
        case 'OPCODE_7': return 7;
        case 'OPCODE_8': return 8;
        case 'OPCODE_9': return 9;
        case 'OPCODE_10': return 10;
        case 'OPCODE_11': return 11;
        case 'OPCODE_12': return 12;
        case 'OPCODE_13': return 13;
        case 'OPCODE_14': return 14;
        case 'OPCODE_15': return 15;
    }
    return 0;
};


/***/ }),

/***/ 6747:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.newNotAllowedError = exports.newTypeMismatchError = exports.newNotFoundError = exports.assertCanWrite = exports.assertName = exports.basename = exports.ctx = void 0;
/**
 * Creates a new {@link NodeFsaContext}.
 */
const ctx = (partial = {}) => {
    return Object.assign({ separator: '/', syncHandleAllowed: false, mode: 'read' }, partial);
};
exports.ctx = ctx;
const basename = (path, separator) => {
    if (path[path.length - 1] === separator)
        path = path.slice(0, -1);
    const lastSlashIndex = path.lastIndexOf(separator);
    return lastSlashIndex === -1 ? path : path.slice(lastSlashIndex + 1);
};
exports.basename = basename;
const nameRegex = /^(\.{1,2})$|^(.*([\/\\]).*)$/;
const assertName = (name, method, klass) => {
    const isInvalid = !name || nameRegex.test(name);
    if (isInvalid)
        throw new TypeError(`Failed to execute '${method}' on '${klass}': Name is not allowed.`);
};
exports.assertName = assertName;
const assertCanWrite = (mode) => {
    if (mode !== 'readwrite')
        throw new DOMException('The request is not allowed by the user agent or the platform in the current context.', 'NotAllowedError');
};
exports.assertCanWrite = assertCanWrite;
const newNotFoundError = () => new DOMException('A requested file or directory could not be found at the time an operation was processed.', 'NotFoundError');
exports.newNotFoundError = newNotFoundError;
const newTypeMismatchError = () => new DOMException('The path supplied exists, but was not an entry of requested type.', 'TypeMismatchError');
exports.newTypeMismatchError = newTypeMismatchError;
const newNotAllowedError = () => new DOMException('Permission not granted.', 'NotAllowedError');
exports.newNotAllowedError = newNotAllowedError;


/***/ }),

/***/ 6762:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.QueueInsert = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const queue_item_1 = __webpack_require__(1800);
const queue_position_1 = __webpack_require__(7548);
class QueueInsert {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsQueueInsert(bb, obj) {
        return (obj || new QueueInsert()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsQueueInsert(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new QueueInsert()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    item(obj) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? (obj || new queue_item_1.QueueItem()).__init(this.bb.__indirect(this.bb_pos + offset), this.bb) : null;
    }
    positionType() {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.readUint8(this.bb_pos + offset) : queue_position_1.QueuePosition.NONE;
    }
    position(obj) {
        const offset = this.bb.__offset(this.bb_pos, 8);
        return offset ? this.bb.__union(obj, this.bb_pos + offset) : null;
    }
    static startQueueInsert(builder) {
        builder.startObject(3);
    }
    static addItem(builder, itemOffset) {
        builder.addFieldOffset(0, itemOffset, 0);
    }
    static addPositionType(builder, positionType) {
        builder.addFieldInt8(1, positionType, queue_position_1.QueuePosition.NONE);
    }
    static addPosition(builder, positionOffset) {
        builder.addFieldOffset(2, positionOffset, 0);
    }
    static endQueueInsert(builder) {
        const offset = builder.endObject();
        builder.requiredField(offset, 4); // item
        builder.requiredField(offset, 8); // position
        return offset;
    }
    static createQueueInsert(builder, itemOffset, positionType, positionOffset) {
        QueueInsert.startQueueInsert(builder);
        QueueInsert.addItem(builder, itemOffset);
        QueueInsert.addPositionType(builder, positionType);
        QueueInsert.addPosition(builder, positionOffset);
        return QueueInsert.endQueueInsert(builder);
    }
}
exports.QueueInsert = QueueInsert;


/***/ }),

/***/ 6928:
/***/ ((module) => {

"use strict";
module.exports = require("path");

/***/ }),

/***/ 6951:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FSWatcher = exports.StatWatcher = exports.Volume = void 0;
exports.filenameToSteps = filenameToSteps;
exports.pathToSteps = pathToSteps;
exports.dataToStr = dataToStr;
exports.toUnixTimestamp = toUnixTimestamp;
const pathModule = __webpack_require__(6928);
const node_1 = __webpack_require__(8581);
const Stats_1 = __webpack_require__(4054);
const Dirent_1 = __webpack_require__(1093);
const buffer_1 = __webpack_require__(9897);
const queueMicrotask_1 = __webpack_require__(4057);
const process_1 = __webpack_require__(5976);
const setTimeoutUnref_1 = __webpack_require__(7204);
const stream_1 = __webpack_require__(2203);
const constants_1 = __webpack_require__(2612);
const events_1 = __webpack_require__(4434);
const encoding_1 = __webpack_require__(2708);
const FileHandle_1 = __webpack_require__(8620);
const util = __webpack_require__(9023);
const FsPromises_1 = __webpack_require__(6073);
const print_1 = __webpack_require__(5537);
const constants_2 = __webpack_require__(1983);
const options_1 = __webpack_require__(5552);
const util_1 = __webpack_require__(4784);
const Dir_1 = __webpack_require__(1934);
const resolveCrossPlatform = pathModule.resolve;
const { O_RDONLY, O_WRONLY, O_RDWR, O_CREAT, O_EXCL, O_TRUNC, O_APPEND, O_DIRECTORY, O_SYMLINK, F_OK, COPYFILE_EXCL, COPYFILE_FICLONE_FORCE, } = constants_1.constants;
const { sep, relative, join, dirname } = pathModule.posix ? pathModule.posix : pathModule;
// ---------------------------------------- Constants
const kMinPoolSpace = 128;
// ---------------------------------------- Error messages
const EPERM = 'EPERM';
const ENOENT = 'ENOENT';
const EBADF = 'EBADF';
const EINVAL = 'EINVAL';
const EEXIST = 'EEXIST';
const ENOTDIR = 'ENOTDIR';
const EMFILE = 'EMFILE';
const EACCES = 'EACCES';
const EISDIR = 'EISDIR';
const ENOTEMPTY = 'ENOTEMPTY';
const ENOSYS = 'ENOSYS';
const ERR_FS_EISDIR = 'ERR_FS_EISDIR';
const ERR_OUT_OF_RANGE = 'ERR_OUT_OF_RANGE';
let resolve = (filename, base = process_1.default.cwd()) => resolveCrossPlatform(base, filename);
if (util_1.isWin) {
    const _resolve = resolve;
    resolve = (filename, base) => (0, util_1.unixify)(_resolve(filename, base));
}
function filenameToSteps(filename, base) {
    const fullPath = resolve(filename, base);
    const fullPathSansSlash = fullPath.substring(1);
    if (!fullPathSansSlash)
        return [];
    return fullPathSansSlash.split(sep);
}
function pathToSteps(path) {
    return filenameToSteps((0, util_1.pathToFilename)(path));
}
function dataToStr(data, encoding = encoding_1.ENCODING_UTF8) {
    if (buffer_1.Buffer.isBuffer(data))
        return data.toString(encoding);
    else if (data instanceof Uint8Array)
        return (0, buffer_1.bufferFrom)(data).toString(encoding);
    else
        return String(data);
}
// converts Date or number to a fractional UNIX timestamp
function toUnixTimestamp(time) {
    // tslint:disable-next-line triple-equals
    if (typeof time === 'string' && +time == time) {
        return +time;
    }
    if (time instanceof Date) {
        return time.getTime() / 1000;
    }
    if (isFinite(time)) {
        if (time < 0) {
            return Date.now() / 1000;
        }
        return time;
    }
    throw new Error('Cannot parse time: ' + time);
}
function validateUid(uid) {
    if (typeof uid !== 'number')
        throw TypeError(constants_2.ERRSTR.UID);
}
function validateGid(gid) {
    if (typeof gid !== 'number')
        throw TypeError(constants_2.ERRSTR.GID);
}
function flattenJSON(nestedJSON) {
    const flatJSON = {};
    function flatten(pathPrefix, node) {
        for (const path in node) {
            const contentOrNode = node[path];
            const joinedPath = join(pathPrefix, path);
            if (typeof contentOrNode === 'string' || contentOrNode instanceof buffer_1.Buffer) {
                flatJSON[joinedPath] = contentOrNode;
            }
            else if (typeof contentOrNode === 'object' && contentOrNode !== null && Object.keys(contentOrNode).length > 0) {
                // empty directories need an explicit entry and therefore get handled in `else`, non-empty ones are implicitly considered
                flatten(joinedPath, contentOrNode);
            }
            else {
                // without this branch null, empty-object or non-object entries would not be handled in the same way
                // by both fromJSON() and fromNestedJSON()
                flatJSON[joinedPath] = null;
            }
        }
    }
    flatten('', nestedJSON);
    return flatJSON;
}
const notImplemented = () => {
    throw new Error('Not implemented');
};
/**
 * `Volume` represents a file system.
 */
class Volume {
    static fromJSON(json, cwd) {
        const vol = new Volume();
        vol.fromJSON(json, cwd);
        return vol;
    }
    static fromNestedJSON(json, cwd) {
        const vol = new Volume();
        vol.fromNestedJSON(json, cwd);
        return vol;
    }
    get promises() {
        if (this.promisesApi === null)
            throw new Error('Promise is not supported in this environment.');
        return this.promisesApi;
    }
    constructor(props = {}) {
        // I-node number counter.
        this.ino = 0;
        // A mapping for i-node numbers to i-nodes (`Node`);
        this.inodes = {};
        // List of released i-node numbers, for reuse.
        this.releasedInos = [];
        // A mapping for file descriptors to `File`s.
        this.fds = {};
        // A list of reusable (opened and closed) file descriptors, that should be
        // used first before creating a new file descriptor.
        this.releasedFds = [];
        // Max number of open files.
        this.maxFiles = 10000;
        // Current number of open files.
        this.openFiles = 0;
        this.promisesApi = new FsPromises_1.FsPromises(this, FileHandle_1.FileHandle);
        this.statWatchers = {};
        this.cpSync = notImplemented;
        this.statfsSync = notImplemented;
        this.cp = notImplemented;
        this.statfs = notImplemented;
        this.openAsBlob = notImplemented;
        this.props = Object.assign({ Node: node_1.Node, Link: node_1.Link, File: node_1.File }, props);
        const root = this.createLink();
        root.setNode(this.createNode(constants_1.constants.S_IFDIR | 0o777));
        const self = this; // tslint:disable-line no-this-assignment
        this.StatWatcher = class extends StatWatcher {
            constructor() {
                super(self);
            }
        };
        const _ReadStream = FsReadStream;
        this.ReadStream = class extends _ReadStream {
            constructor(...args) {
                super(self, ...args);
            }
        };
        const _WriteStream = FsWriteStream;
        this.WriteStream = class extends _WriteStream {
            constructor(...args) {
                super(self, ...args);
            }
        };
        this.FSWatcher = class extends FSWatcher {
            constructor() {
                super(self);
            }
        };
        root.setChild('.', root);
        root.getNode().nlink++;
        root.setChild('..', root);
        root.getNode().nlink++;
        this.root = root;
    }
    createLink(parent, name, isDirectory = false, mode) {
        if (!parent) {
            return new this.props.Link(this, null, '');
        }
        if (!name) {
            throw new Error('createLink: name cannot be empty');
        }
        // If no explicit permission is provided, use defaults based on type
        const finalPerm = mode !== null && mode !== void 0 ? mode : (isDirectory ? 0o777 : 0o666);
        // To prevent making a breaking change, `mode` can also just be a permission number
        // and the file type is set based on `isDirectory`
        const hasFileType = mode && mode & constants_1.constants.S_IFMT;
        const modeType = hasFileType ? mode & constants_1.constants.S_IFMT : isDirectory ? constants_1.constants.S_IFDIR : constants_1.constants.S_IFREG;
        const finalMode = (finalPerm & ~constants_1.constants.S_IFMT) | modeType;
        return parent.createChild(name, this.createNode(finalMode));
    }
    deleteLink(link) {
        const parent = link.parent;
        if (parent) {
            parent.deleteChild(link);
            return true;
        }
        return false;
    }
    newInoNumber() {
        const releasedFd = this.releasedInos.pop();
        if (releasedFd)
            return releasedFd;
        else {
            this.ino = (this.ino + 1) % 0xffffffff;
            return this.ino;
        }
    }
    newFdNumber() {
        const releasedFd = this.releasedFds.pop();
        return typeof releasedFd === 'number' ? releasedFd : Volume.fd--;
    }
    createNode(mode) {
        const node = new this.props.Node(this.newInoNumber(), mode);
        this.inodes[node.ino] = node;
        return node;
    }
    deleteNode(node) {
        node.del();
        delete this.inodes[node.ino];
        this.releasedInos.push(node.ino);
    }
    walk(stepsOrFilenameOrLink, resolveSymlinks = false, checkExistence = false, checkAccess = false, funcName) {
        var _a;
        let steps;
        let filename;
        if (stepsOrFilenameOrLink instanceof node_1.Link) {
            steps = stepsOrFilenameOrLink.steps;
            filename = sep + steps.join(sep);
        }
        else if (typeof stepsOrFilenameOrLink === 'string') {
            steps = filenameToSteps(stepsOrFilenameOrLink);
            filename = stepsOrFilenameOrLink;
        }
        else {
            steps = stepsOrFilenameOrLink;
            filename = sep + steps.join(sep);
        }
        let curr = this.root;
        let i = 0;
        while (i < steps.length) {
            let node = curr.getNode();
            // Check access permissions if current link is a directory
            if (node.isDirectory()) {
                if (checkAccess && !node.canExecute()) {
                    throw (0, util_1.createError)(EACCES, funcName, filename);
                }
            }
            else {
                if (i < steps.length - 1)
                    throw (0, util_1.createError)(ENOTDIR, funcName, filename);
            }
            curr = (_a = curr.getChild(steps[i])) !== null && _a !== void 0 ? _a : null;
            // Check existence of current link
            if (!curr)
                if (checkExistence)
                    throw (0, util_1.createError)(ENOENT, funcName, filename);
                else
                    return null;
            node = curr === null || curr === void 0 ? void 0 : curr.getNode();
            // Resolve symlink
            if (resolveSymlinks && node.isSymlink()) {
                const resolvedPath = pathModule.isAbsolute(node.symlink)
                    ? node.symlink
                    : join(pathModule.dirname(curr.getPath()), node.symlink); // Relative to symlink's parent
                steps = filenameToSteps(resolvedPath).concat(steps.slice(i + 1));
                curr = this.root;
                i = 0;
                continue;
            }
            i++;
        }
        return curr;
    }
    // Returns a `Link` (hard link) referenced by path "split" into steps.
    getLink(steps) {
        return this.walk(steps, false, false, false);
    }
    // Just link `getLink`, but throws a correct user error, if link to found.
    getLinkOrThrow(filename, funcName) {
        return this.walk(filename, false, true, true, funcName);
    }
    // Just like `getLink`, but also dereference/resolves symbolic links.
    getResolvedLink(filenameOrSteps) {
        return this.walk(filenameOrSteps, true, false, false);
    }
    // Just like `getLinkOrThrow`, but also dereference/resolves symbolic links.
    getResolvedLinkOrThrow(filename, funcName) {
        return this.walk(filename, true, true, true, funcName);
    }
    resolveSymlinks(link) {
        return this.getResolvedLink(link.steps.slice(1));
    }
    // Just like `getLinkOrThrow`, but also verifies that the link is a directory.
    getLinkAsDirOrThrow(filename, funcName) {
        const link = this.getLinkOrThrow(filename, funcName);
        if (!link.getNode().isDirectory())
            throw (0, util_1.createError)(ENOTDIR, funcName, filename);
        return link;
    }
    // Get the immediate parent directory of the link.
    getLinkParent(steps) {
        return this.getLink(steps.slice(0, -1));
    }
    getLinkParentAsDirOrThrow(filenameOrSteps, funcName) {
        const steps = (filenameOrSteps instanceof Array ? filenameOrSteps : filenameToSteps(filenameOrSteps)).slice(0, -1);
        const filename = sep + steps.join(sep);
        const link = this.getLinkOrThrow(filename, funcName);
        if (!link.getNode().isDirectory())
            throw (0, util_1.createError)(ENOTDIR, funcName, filename);
        return link;
    }
    getFileByFd(fd) {
        return this.fds[String(fd)];
    }
    getFileByFdOrThrow(fd, funcName) {
        if (!(0, util_1.isFd)(fd))
            throw TypeError(constants_2.ERRSTR.FD);
        const file = this.getFileByFd(fd);
        if (!file)
            throw (0, util_1.createError)(EBADF, funcName);
        return file;
    }
    /**
     * @todo This is not used anymore. Remove.
     */
    /*
    private getNodeByIdOrCreate(id: TFileId, flags: number, perm: number): Node {
      if (typeof id === 'number') {
        const file = this.getFileByFd(id);
        if (!file) throw Error('File nto found');
        return file.node;
      } else {
        const steps = pathToSteps(id as PathLike);
        let link = this.getLink(steps);
        if (link) return link.getNode();
  
        // Try creating a node if not found.
        if (flags & O_CREAT) {
          const dirLink = this.getLinkParent(steps);
          if (dirLink) {
            const name = steps[steps.length - 1];
            link = this.createLink(dirLink, name, false, perm);
            return link.getNode();
          }
        }
  
        throw createError(ENOENT, 'getNodeByIdOrCreate', pathToFilename(id));
      }
    }
    */
    wrapAsync(method, args, callback) {
        (0, util_1.validateCallback)(callback);
        Promise.resolve().then(() => {
            let result;
            try {
                result = method.apply(this, args);
            }
            catch (err) {
                callback(err);
                return;
            }
            callback(null, result);
        });
    }
    _toJSON(link = this.root, json = {}, path, asBuffer) {
        let isEmpty = true;
        let children = link.children;
        if (link.getNode().isFile()) {
            children = new Map([[link.getName(), link.parent.getChild(link.getName())]]);
            link = link.parent;
        }
        for (const name of children.keys()) {
            if (name === '.' || name === '..') {
                continue;
            }
            isEmpty = false;
            const child = link.getChild(name);
            if (!child) {
                throw new Error('_toJSON: unexpected undefined');
            }
            const node = child.getNode();
            if (node.isFile()) {
                let filename = child.getPath();
                if (path)
                    filename = relative(path, filename);
                json[filename] = asBuffer ? node.getBuffer() : node.getString();
            }
            else if (node.isDirectory()) {
                this._toJSON(child, json, path, asBuffer);
            }
        }
        let dirPath = link.getPath();
        if (path)
            dirPath = relative(path, dirPath);
        if (dirPath && isEmpty) {
            json[dirPath] = null;
        }
        return json;
    }
    toJSON(paths, json = {}, isRelative = false, asBuffer = false) {
        const links = [];
        if (paths) {
            if (!Array.isArray(paths))
                paths = [paths];
            for (const path of paths) {
                const filename = (0, util_1.pathToFilename)(path);
                const link = this.getResolvedLink(filename);
                if (!link)
                    continue;
                links.push(link);
            }
        }
        else {
            links.push(this.root);
        }
        if (!links.length)
            return json;
        for (const link of links)
            this._toJSON(link, json, isRelative ? link.getPath() : '', asBuffer);
        return json;
    }
    // TODO: `cwd` should probably not invoke `process.cwd()`.
    fromJSON(json, cwd = process_1.default.cwd()) {
        for (let filename in json) {
            const data = json[filename];
            filename = resolve(filename, cwd);
            if (typeof data === 'string' || data instanceof buffer_1.Buffer) {
                const dir = dirname(filename);
                this.mkdirpBase(dir, 511 /* MODE.DIR */);
                this.writeFileSync(filename, data);
            }
            else {
                this.mkdirpBase(filename, 511 /* MODE.DIR */);
            }
        }
    }
    fromNestedJSON(json, cwd) {
        this.fromJSON(flattenJSON(json), cwd);
    }
    toTree(opts = { separator: sep }) {
        return (0, print_1.toTreeSync)(this, opts);
    }
    reset() {
        this.ino = 0;
        this.inodes = {};
        this.releasedInos = [];
        this.fds = {};
        this.releasedFds = [];
        this.openFiles = 0;
        this.root = this.createLink();
        this.root.setNode(this.createNode(constants_1.constants.S_IFDIR | 0o777));
    }
    // Legacy interface
    mountSync(mountpoint, json) {
        this.fromJSON(json, mountpoint);
    }
    openLink(link, flagsNum, resolveSymlinks = true) {
        if (this.openFiles >= this.maxFiles) {
            // Too many open files.
            throw (0, util_1.createError)(EMFILE, 'open', link.getPath());
        }
        // Resolve symlinks.
        //
        // @TODO: This should be superfluous. This method is only ever called by openFile(), which does its own symlink resolution
        // prior to calling.
        let realLink = link;
        if (resolveSymlinks)
            realLink = this.getResolvedLinkOrThrow(link.getPath(), 'open');
        const node = realLink.getNode();
        // Check whether node is a directory
        if (node.isDirectory()) {
            if ((flagsNum & (O_RDONLY | O_RDWR | O_WRONLY)) !== O_RDONLY)
                throw (0, util_1.createError)(EISDIR, 'open', link.getPath());
        }
        else {
            if (flagsNum & O_DIRECTORY)
                throw (0, util_1.createError)(ENOTDIR, 'open', link.getPath());
        }
        // Check node permissions
        if (!(flagsNum & O_WRONLY)) {
            if (!node.canRead()) {
                throw (0, util_1.createError)(EACCES, 'open', link.getPath());
            }
        }
        if (!(flagsNum & O_RDONLY)) {
            if (!node.canWrite()) {
                throw (0, util_1.createError)(EACCES, 'open', link.getPath());
            }
        }
        const file = new this.props.File(link, node, flagsNum, this.newFdNumber());
        this.fds[file.fd] = file;
        this.openFiles++;
        if (flagsNum & O_TRUNC)
            file.truncate();
        return file;
    }
    openFile(filename, flagsNum, modeNum, resolveSymlinks = true) {
        const steps = filenameToSteps(filename);
        let link;
        try {
            link = resolveSymlinks ? this.getResolvedLinkOrThrow(filename, 'open') : this.getLinkOrThrow(filename, 'open');
            // Check if file already existed when trying to create it exclusively (O_CREAT and O_EXCL flags are set).
            // This is an error, see https://pubs.opengroup.org/onlinepubs/009695399/functions/open.html:
            // "If O_CREAT and O_EXCL are set, open() shall fail if the file exists."
            if (link && flagsNum & O_CREAT && flagsNum & O_EXCL)
                throw (0, util_1.createError)(EEXIST, 'open', filename);
        }
        catch (err) {
            // Try creating a new file, if it does not exist and O_CREAT flag is set.
            // Note that this will still throw if the ENOENT came from one of the
            // intermediate directories instead of the file itself.
            if (err.code === ENOENT && flagsNum & O_CREAT) {
                const dirname = pathModule.dirname(filename);
                const dirLink = this.getResolvedLinkOrThrow(dirname);
                const dirNode = dirLink.getNode();
                // Check that the place we create the new file is actually a directory and that we are allowed to do so:
                if (!dirNode.isDirectory())
                    throw (0, util_1.createError)(ENOTDIR, 'open', filename);
                if (!dirNode.canExecute() || !dirNode.canWrite())
                    throw (0, util_1.createError)(EACCES, 'open', filename);
                // This is a difference to the original implementation, which would simply not create a file unless modeNum was specified.
                // However, current Node versions will default to 0o666.
                modeNum !== null && modeNum !== void 0 ? modeNum : (modeNum = 0o666);
                link = this.createLink(dirLink, steps[steps.length - 1], false, modeNum);
            }
            else
                throw err;
        }
        if (link)
            return this.openLink(link, flagsNum, resolveSymlinks);
        throw (0, util_1.createError)(ENOENT, 'open', filename);
    }
    openBase(filename, flagsNum, modeNum, resolveSymlinks = true) {
        const file = this.openFile(filename, flagsNum, modeNum, resolveSymlinks);
        if (!file)
            throw (0, util_1.createError)(ENOENT, 'open', filename);
        return file.fd;
    }
    openSync(path, flags, mode = 438 /* MODE.DEFAULT */) {
        // Validate (1) mode; (2) path; (3) flags - in that order.
        const modeNum = (0, util_1.modeToNumber)(mode);
        const fileName = (0, util_1.pathToFilename)(path);
        const flagsNum = (0, util_1.flagsToNumber)(flags);
        return this.openBase(fileName, flagsNum, modeNum, !(flagsNum & O_SYMLINK));
    }
    open(path, flags, a, b) {
        let mode = a;
        let callback = b;
        if (typeof a === 'function') {
            mode = 438 /* MODE.DEFAULT */;
            callback = a;
        }
        mode = mode || 438 /* MODE.DEFAULT */;
        const modeNum = (0, util_1.modeToNumber)(mode);
        const fileName = (0, util_1.pathToFilename)(path);
        const flagsNum = (0, util_1.flagsToNumber)(flags);
        this.wrapAsync(this.openBase, [fileName, flagsNum, modeNum, !(flagsNum & O_SYMLINK)], callback);
    }
    closeFile(file) {
        if (!this.fds[file.fd])
            return;
        this.openFiles--;
        delete this.fds[file.fd];
        this.releasedFds.push(file.fd);
    }
    closeSync(fd) {
        (0, util_1.validateFd)(fd);
        const file = this.getFileByFdOrThrow(fd, 'close');
        this.closeFile(file);
    }
    close(fd, callback) {
        (0, util_1.validateFd)(fd);
        const file = this.getFileByFdOrThrow(fd, 'close');
        // NOTE: not calling closeSync because we can reset in between close and closeSync
        this.wrapAsync(this.closeFile, [file], callback);
    }
    openFileOrGetById(id, flagsNum, modeNum) {
        if (typeof id === 'number') {
            const file = this.fds[id];
            if (!file)
                throw (0, util_1.createError)(ENOENT);
            return file;
        }
        else {
            return this.openFile((0, util_1.pathToFilename)(id), flagsNum, modeNum);
        }
    }
    readBase(fd, buffer, offset, length, position) {
        if (buffer.byteLength < length) {
            throw (0, util_1.createError)(ERR_OUT_OF_RANGE, 'read', undefined, undefined, RangeError);
        }
        const file = this.getFileByFdOrThrow(fd);
        if (file.node.isSymlink()) {
            throw (0, util_1.createError)(EPERM, 'read', file.link.getPath());
        }
        return file.read(buffer, Number(offset), Number(length), position === -1 || typeof position !== 'number' ? undefined : position);
    }
    readSync(fd, buffer, offset, length, position) {
        (0, util_1.validateFd)(fd);
        return this.readBase(fd, buffer, offset, length, position);
    }
    read(fd, buffer, offset, length, position, callback) {
        (0, util_1.validateCallback)(callback);
        // This `if` branch is from Node.js
        if (length === 0) {
            return (0, queueMicrotask_1.default)(() => {
                if (callback)
                    callback(null, 0, buffer);
            });
        }
        Promise.resolve().then(() => {
            try {
                const bytes = this.readBase(fd, buffer, offset, length, position);
                callback(null, bytes, buffer);
            }
            catch (err) {
                callback(err);
            }
        });
    }
    readvBase(fd, buffers, position) {
        const file = this.getFileByFdOrThrow(fd);
        let p = position !== null && position !== void 0 ? position : undefined;
        if (p === -1) {
            p = undefined;
        }
        let bytesRead = 0;
        for (const buffer of buffers) {
            const bytes = file.read(buffer, 0, buffer.byteLength, p);
            p = undefined;
            bytesRead += bytes;
            if (bytes < buffer.byteLength)
                break;
        }
        return bytesRead;
    }
    readv(fd, buffers, a, b) {
        let position = a;
        let callback = b;
        if (typeof a === 'function') {
            position = null;
            callback = a;
        }
        (0, util_1.validateCallback)(callback);
        Promise.resolve().then(() => {
            try {
                const bytes = this.readvBase(fd, buffers, position);
                callback(null, bytes, buffers);
            }
            catch (err) {
                callback(err);
            }
        });
    }
    readvSync(fd, buffers, position) {
        (0, util_1.validateFd)(fd);
        return this.readvBase(fd, buffers, position);
    }
    readFileBase(id, flagsNum, encoding) {
        let result;
        const isUserFd = typeof id === 'number';
        const userOwnsFd = isUserFd && (0, util_1.isFd)(id);
        let fd;
        if (userOwnsFd)
            fd = id;
        else {
            const filename = (0, util_1.pathToFilename)(id);
            const link = this.getResolvedLinkOrThrow(filename, 'open');
            const node = link.getNode();
            if (node.isDirectory())
                throw (0, util_1.createError)(EISDIR, 'open', link.getPath());
            fd = this.openSync(id, flagsNum);
        }
        try {
            result = (0, util_1.bufferToEncoding)(this.getFileByFdOrThrow(fd).getBuffer(), encoding);
        }
        finally {
            if (!userOwnsFd) {
                this.closeSync(fd);
            }
        }
        return result;
    }
    readFileSync(file, options) {
        const opts = (0, options_1.getReadFileOptions)(options);
        const flagsNum = (0, util_1.flagsToNumber)(opts.flag);
        return this.readFileBase(file, flagsNum, opts.encoding);
    }
    readFile(id, a, b) {
        const [opts, callback] = (0, options_1.optsAndCbGenerator)(options_1.getReadFileOptions)(a, b);
        const flagsNum = (0, util_1.flagsToNumber)(opts.flag);
        this.wrapAsync(this.readFileBase, [id, flagsNum, opts.encoding], callback);
    }
    writeBase(fd, buf, offset, length, position) {
        const file = this.getFileByFdOrThrow(fd, 'write');
        if (file.node.isSymlink()) {
            throw (0, util_1.createError)(EBADF, 'write', file.link.getPath());
        }
        return file.write(buf, offset, length, position === -1 || typeof position !== 'number' ? undefined : position);
    }
    writeSync(fd, a, b, c, d) {
        const [, buf, offset, length, position] = (0, util_1.getWriteSyncArgs)(fd, a, b, c, d);
        return this.writeBase(fd, buf, offset, length, position);
    }
    write(fd, a, b, c, d, e) {
        const [, asStr, buf, offset, length, position, cb] = (0, util_1.getWriteArgs)(fd, a, b, c, d, e);
        Promise.resolve().then(() => {
            try {
                const bytes = this.writeBase(fd, buf, offset, length, position);
                if (!asStr) {
                    cb(null, bytes, buf);
                }
                else {
                    cb(null, bytes, a);
                }
            }
            catch (err) {
                cb(err);
            }
        });
    }
    writevBase(fd, buffers, position) {
        const file = this.getFileByFdOrThrow(fd);
        let p = position !== null && position !== void 0 ? position : undefined;
        if (p === -1) {
            p = undefined;
        }
        let bytesWritten = 0;
        for (const buffer of buffers) {
            const nodeBuf = buffer_1.Buffer.from(buffer.buffer, buffer.byteOffset, buffer.byteLength);
            const bytes = file.write(nodeBuf, 0, nodeBuf.byteLength, p);
            p = undefined;
            bytesWritten += bytes;
            if (bytes < nodeBuf.byteLength)
                break;
        }
        return bytesWritten;
    }
    writev(fd, buffers, a, b) {
        let position = a;
        let callback = b;
        if (typeof a === 'function') {
            position = null;
            callback = a;
        }
        (0, util_1.validateCallback)(callback);
        Promise.resolve().then(() => {
            try {
                const bytes = this.writevBase(fd, buffers, position);
                callback(null, bytes, buffers);
            }
            catch (err) {
                callback(err);
            }
        });
    }
    writevSync(fd, buffers, position) {
        (0, util_1.validateFd)(fd);
        return this.writevBase(fd, buffers, position);
    }
    writeFileBase(id, buf, flagsNum, modeNum) {
        // console.log('writeFileBase', id, buf, flagsNum, modeNum);
        // const node = this.getNodeByIdOrCreate(id, flagsNum, modeNum);
        // node.setBuffer(buf);
        const isUserFd = typeof id === 'number';
        let fd;
        if (isUserFd)
            fd = id;
        else {
            fd = this.openBase((0, util_1.pathToFilename)(id), flagsNum, modeNum);
            // fd = this.openSync(id as PathLike, flagsNum, modeNum);
        }
        let offset = 0;
        let length = buf.length;
        let position = flagsNum & O_APPEND ? undefined : 0;
        try {
            while (length > 0) {
                const written = this.writeSync(fd, buf, offset, length, position);
                offset += written;
                length -= written;
                if (position !== undefined)
                    position += written;
            }
        }
        finally {
            if (!isUserFd)
                this.closeSync(fd);
        }
    }
    writeFileSync(id, data, options) {
        const opts = (0, options_1.getWriteFileOptions)(options);
        const flagsNum = (0, util_1.flagsToNumber)(opts.flag);
        const modeNum = (0, util_1.modeToNumber)(opts.mode);
        const buf = (0, util_1.dataToBuffer)(data, opts.encoding);
        this.writeFileBase(id, buf, flagsNum, modeNum);
    }
    writeFile(id, data, a, b) {
        let options = a;
        let callback = b;
        if (typeof a === 'function') {
            options = options_1.writeFileDefaults;
            callback = a;
        }
        const cb = (0, util_1.validateCallback)(callback);
        const opts = (0, options_1.getWriteFileOptions)(options);
        const flagsNum = (0, util_1.flagsToNumber)(opts.flag);
        const modeNum = (0, util_1.modeToNumber)(opts.mode);
        const buf = (0, util_1.dataToBuffer)(data, opts.encoding);
        this.wrapAsync(this.writeFileBase, [id, buf, flagsNum, modeNum], cb);
    }
    linkBase(filename1, filename2) {
        let link1;
        try {
            link1 = this.getLinkOrThrow(filename1, 'link');
        }
        catch (err) {
            // Augment error with filename2
            if (err.code)
                err = (0, util_1.createError)(err.code, 'link', filename1, filename2);
            throw err;
        }
        const dirname2 = pathModule.dirname(filename2);
        let dir2;
        try {
            dir2 = this.getLinkOrThrow(dirname2, 'link');
        }
        catch (err) {
            // Augment error with filename1
            if (err.code)
                err = (0, util_1.createError)(err.code, 'link', filename1, filename2);
            throw err;
        }
        const name = pathModule.basename(filename2);
        // Check if new file already exists.
        if (dir2.getChild(name))
            throw (0, util_1.createError)(EEXIST, 'link', filename1, filename2);
        const node = link1.getNode();
        node.nlink++;
        dir2.createChild(name, node);
    }
    copyFileBase(src, dest, flags) {
        const buf = this.readFileSync(src);
        if (flags & COPYFILE_EXCL) {
            if (this.existsSync(dest)) {
                throw (0, util_1.createError)(EEXIST, 'copyFile', src, dest);
            }
        }
        if (flags & COPYFILE_FICLONE_FORCE) {
            throw (0, util_1.createError)(ENOSYS, 'copyFile', src, dest);
        }
        this.writeFileBase(dest, buf, constants_2.FLAGS.w, 438 /* MODE.DEFAULT */);
    }
    copyFileSync(src, dest, flags) {
        const srcFilename = (0, util_1.pathToFilename)(src);
        const destFilename = (0, util_1.pathToFilename)(dest);
        return this.copyFileBase(srcFilename, destFilename, (flags || 0) | 0);
    }
    copyFile(src, dest, a, b) {
        const srcFilename = (0, util_1.pathToFilename)(src);
        const destFilename = (0, util_1.pathToFilename)(dest);
        let flags;
        let callback;
        if (typeof a === 'function') {
            flags = 0;
            callback = a;
        }
        else {
            flags = a;
            callback = b;
        }
        (0, util_1.validateCallback)(callback);
        this.wrapAsync(this.copyFileBase, [srcFilename, destFilename, flags], callback);
    }
    linkSync(existingPath, newPath) {
        const existingPathFilename = (0, util_1.pathToFilename)(existingPath);
        const newPathFilename = (0, util_1.pathToFilename)(newPath);
        this.linkBase(existingPathFilename, newPathFilename);
    }
    link(existingPath, newPath, callback) {
        const existingPathFilename = (0, util_1.pathToFilename)(existingPath);
        const newPathFilename = (0, util_1.pathToFilename)(newPath);
        this.wrapAsync(this.linkBase, [existingPathFilename, newPathFilename], callback);
    }
    unlinkBase(filename) {
        const link = this.getLinkOrThrow(filename, 'unlink');
        // TODO: Check if it is file, dir, other...
        if (link.length)
            throw Error('Dir not empty...');
        this.deleteLink(link);
        const node = link.getNode();
        node.nlink--;
        // When all hard links to i-node are deleted, remove the i-node, too.
        if (node.nlink <= 0) {
            this.deleteNode(node);
        }
    }
    unlinkSync(path) {
        const filename = (0, util_1.pathToFilename)(path);
        this.unlinkBase(filename);
    }
    unlink(path, callback) {
        const filename = (0, util_1.pathToFilename)(path);
        this.wrapAsync(this.unlinkBase, [filename], callback);
    }
    symlinkBase(targetFilename, pathFilename) {
        const pathSteps = filenameToSteps(pathFilename);
        // Check if directory exists, where we about to create a symlink.
        let dirLink;
        try {
            dirLink = this.getLinkParentAsDirOrThrow(pathSteps);
        }
        catch (err) {
            // Catch error to populate with the correct fields - getLinkParentAsDirOrThrow won't be aware of the second path
            if (err.code)
                err = (0, util_1.createError)(err.code, 'symlink', targetFilename, pathFilename);
            throw err;
        }
        const name = pathSteps[pathSteps.length - 1];
        // Check if new file already exists.
        if (dirLink.getChild(name))
            throw (0, util_1.createError)(EEXIST, 'symlink', targetFilename, pathFilename);
        // Check permissions on the path where we are creating the symlink.
        // Note we're not checking permissions on the target path: It is not an error to create a symlink to a
        // non-existent or inaccessible target
        const node = dirLink.getNode();
        if (!node.canExecute() || !node.canWrite())
            throw (0, util_1.createError)(EACCES, 'symlink', targetFilename, pathFilename);
        // Create symlink.
        const symlink = dirLink.createChild(name);
        symlink.getNode().makeSymlink(targetFilename);
        return symlink;
    }
    // `type` argument works only on Windows.
    symlinkSync(target, path, type) {
        const targetFilename = (0, util_1.pathToFilename)(target);
        const pathFilename = (0, util_1.pathToFilename)(path);
        this.symlinkBase(targetFilename, pathFilename);
    }
    symlink(target, path, a, b) {
        const callback = (0, util_1.validateCallback)(typeof a === 'function' ? a : b);
        const targetFilename = (0, util_1.pathToFilename)(target);
        const pathFilename = (0, util_1.pathToFilename)(path);
        this.wrapAsync(this.symlinkBase, [targetFilename, pathFilename], callback);
    }
    realpathBase(filename, encoding) {
        const realLink = this.getResolvedLinkOrThrow(filename, 'realpath');
        return (0, encoding_1.strToEncoding)(realLink.getPath() || '/', encoding);
    }
    realpathSync(path, options) {
        return this.realpathBase((0, util_1.pathToFilename)(path), (0, options_1.getRealpathOptions)(options).encoding);
    }
    realpath(path, a, b) {
        const [opts, callback] = (0, options_1.getRealpathOptsAndCb)(a, b);
        const pathFilename = (0, util_1.pathToFilename)(path);
        this.wrapAsync(this.realpathBase, [pathFilename, opts.encoding], callback);
    }
    lstatBase(filename, bigint = false, throwIfNoEntry = false) {
        let link;
        try {
            link = this.getLinkOrThrow(filename, 'lstat');
        }
        catch (err) {
            if (err.code === ENOENT && !throwIfNoEntry)
                return undefined;
            else
                throw err;
        }
        return Stats_1.default.build(link.getNode(), bigint);
    }
    lstatSync(path, options) {
        const { throwIfNoEntry = true, bigint = false } = (0, options_1.getStatOptions)(options);
        return this.lstatBase((0, util_1.pathToFilename)(path), bigint, throwIfNoEntry);
    }
    lstat(path, a, b) {
        const [{ throwIfNoEntry = true, bigint = false }, callback] = (0, options_1.getStatOptsAndCb)(a, b);
        this.wrapAsync(this.lstatBase, [(0, util_1.pathToFilename)(path), bigint, throwIfNoEntry], callback);
    }
    statBase(filename, bigint = false, throwIfNoEntry = true) {
        let link;
        try {
            link = this.getResolvedLinkOrThrow(filename, 'stat');
        }
        catch (err) {
            if (err.code === ENOENT && !throwIfNoEntry)
                return undefined;
            else
                throw err;
        }
        return Stats_1.default.build(link.getNode(), bigint);
    }
    statSync(path, options) {
        const { bigint = true, throwIfNoEntry = true } = (0, options_1.getStatOptions)(options);
        return this.statBase((0, util_1.pathToFilename)(path), bigint, throwIfNoEntry);
    }
    stat(path, a, b) {
        const [{ bigint = false, throwIfNoEntry = true }, callback] = (0, options_1.getStatOptsAndCb)(a, b);
        this.wrapAsync(this.statBase, [(0, util_1.pathToFilename)(path), bigint, throwIfNoEntry], callback);
    }
    fstatBase(fd, bigint = false) {
        const file = this.getFileByFd(fd);
        if (!file)
            throw (0, util_1.createError)(EBADF, 'fstat');
        return Stats_1.default.build(file.node, bigint);
    }
    fstatSync(fd, options) {
        return this.fstatBase(fd, (0, options_1.getStatOptions)(options).bigint);
    }
    fstat(fd, a, b) {
        const [opts, callback] = (0, options_1.getStatOptsAndCb)(a, b);
        this.wrapAsync(this.fstatBase, [fd, opts.bigint], callback);
    }
    renameBase(oldPathFilename, newPathFilename) {
        let link;
        try {
            link = this.getResolvedLinkOrThrow(oldPathFilename);
        }
        catch (err) {
            // Augment err with newPathFilename
            if (err.code)
                err = (0, util_1.createError)(err.code, 'rename', oldPathFilename, newPathFilename);
            throw err;
        }
        // TODO: Check if it is directory, if non-empty, we cannot move it, right?
        // Check directory exists for the new location.
        let newPathDirLink;
        try {
            newPathDirLink = this.getLinkParentAsDirOrThrow(newPathFilename);
        }
        catch (err) {
            // Augment error with oldPathFilename
            if (err.code)
                err = (0, util_1.createError)(err.code, 'rename', oldPathFilename, newPathFilename);
            throw err;
        }
        // TODO: Also treat cases with directories and symbolic links.
        // TODO: See: http://man7.org/linux/man-pages/man2/rename.2.html
        // Remove hard link from old folder.
        const oldLinkParent = link.parent;
        // Check we have access and write permissions in both places
        const oldParentNode = oldLinkParent.getNode();
        const newPathDirNode = newPathDirLink.getNode();
        if (!oldParentNode.canExecute() ||
            !oldParentNode.canWrite() ||
            !newPathDirNode.canExecute() ||
            !newPathDirNode.canWrite()) {
            throw (0, util_1.createError)(EACCES, 'rename', oldPathFilename, newPathFilename);
        }
        oldLinkParent.deleteChild(link);
        // Rename should overwrite the new path, if that exists.
        const name = pathModule.basename(newPathFilename);
        link.name = name;
        link.steps = [...newPathDirLink.steps, name];
        newPathDirLink.setChild(link.getName(), link);
    }
    renameSync(oldPath, newPath) {
        const oldPathFilename = (0, util_1.pathToFilename)(oldPath);
        const newPathFilename = (0, util_1.pathToFilename)(newPath);
        this.renameBase(oldPathFilename, newPathFilename);
    }
    rename(oldPath, newPath, callback) {
        const oldPathFilename = (0, util_1.pathToFilename)(oldPath);
        const newPathFilename = (0, util_1.pathToFilename)(newPath);
        this.wrapAsync(this.renameBase, [oldPathFilename, newPathFilename], callback);
    }
    existsBase(filename) {
        return !!this.statBase(filename);
    }
    existsSync(path) {
        try {
            return this.existsBase((0, util_1.pathToFilename)(path));
        }
        catch (err) {
            return false;
        }
    }
    exists(path, callback) {
        const filename = (0, util_1.pathToFilename)(path);
        if (typeof callback !== 'function')
            throw Error(constants_2.ERRSTR.CB);
        Promise.resolve().then(() => {
            try {
                callback(this.existsBase(filename));
            }
            catch (err) {
                callback(false);
            }
        });
    }
    accessBase(filename, mode) {
        const link = this.getLinkOrThrow(filename, 'access');
    }
    accessSync(path, mode = F_OK) {
        const filename = (0, util_1.pathToFilename)(path);
        mode = mode | 0;
        this.accessBase(filename, mode);
    }
    access(path, a, b) {
        let mode = F_OK;
        let callback;
        if (typeof a !== 'function') {
            mode = a | 0; // cast to number
            callback = (0, util_1.validateCallback)(b);
        }
        else {
            callback = a;
        }
        const filename = (0, util_1.pathToFilename)(path);
        this.wrapAsync(this.accessBase, [filename, mode], callback);
    }
    appendFileSync(id, data, options) {
        const opts = (0, options_1.getAppendFileOpts)(options);
        // force append behavior when using a supplied file descriptor
        if (!opts.flag || (0, util_1.isFd)(id))
            opts.flag = 'a';
        this.writeFileSync(id, data, opts);
    }
    appendFile(id, data, a, b) {
        const [opts, callback] = (0, options_1.getAppendFileOptsAndCb)(a, b);
        // force append behavior when using a supplied file descriptor
        if (!opts.flag || (0, util_1.isFd)(id))
            opts.flag = 'a';
        this.writeFile(id, data, opts, callback);
    }
    readdirBase(filename, options) {
        const steps = filenameToSteps(filename);
        const link = this.getResolvedLinkOrThrow(filename, 'scandir');
        const node = link.getNode();
        if (!node.isDirectory())
            throw (0, util_1.createError)(ENOTDIR, 'scandir', filename);
        // Check we have permissions
        if (!node.canRead())
            throw (0, util_1.createError)(EACCES, 'scandir', filename);
        const list = []; // output list
        for (const name of link.children.keys()) {
            const child = link.getChild(name);
            if (!child || name === '.' || name === '..')
                continue;
            list.push(Dirent_1.default.build(child, options.encoding));
            // recursion
            if (options.recursive && child.children.size) {
                const recurseOptions = Object.assign(Object.assign({}, options), { recursive: true, withFileTypes: true });
                const childList = this.readdirBase(child.getPath(), recurseOptions);
                list.push(...childList);
            }
        }
        if (!util_1.isWin && options.encoding !== 'buffer')
            list.sort((a, b) => {
                if (a.name < b.name)
                    return -1;
                if (a.name > b.name)
                    return 1;
                return 0;
            });
        if (options.withFileTypes)
            return list;
        let filename2 = filename;
        if (util_1.isWin) {
            filename2 = filename2.replace(/\\/g, '/');
        }
        return list.map(dirent => {
            if (options.recursive) {
                let fullPath = pathModule.join(dirent.parentPath, dirent.name.toString());
                if (util_1.isWin) {
                    fullPath = fullPath.replace(/\\/g, '/');
                }
                return fullPath.replace(filename2 + pathModule.posix.sep, '');
            }
            return dirent.name;
        });
    }
    readdirSync(path, options) {
        const opts = (0, options_1.getReaddirOptions)(options);
        const filename = (0, util_1.pathToFilename)(path);
        return this.readdirBase(filename, opts);
    }
    readdir(path, a, b) {
        const [options, callback] = (0, options_1.getReaddirOptsAndCb)(a, b);
        const filename = (0, util_1.pathToFilename)(path);
        this.wrapAsync(this.readdirBase, [filename, options], callback);
    }
    readlinkBase(filename, encoding) {
        const link = this.getLinkOrThrow(filename, 'readlink');
        const node = link.getNode();
        if (!node.isSymlink())
            throw (0, util_1.createError)(EINVAL, 'readlink', filename);
        return (0, encoding_1.strToEncoding)(node.symlink, encoding);
    }
    readlinkSync(path, options) {
        const opts = (0, options_1.getDefaultOpts)(options);
        const filename = (0, util_1.pathToFilename)(path);
        return this.readlinkBase(filename, opts.encoding);
    }
    readlink(path, a, b) {
        const [opts, callback] = (0, options_1.getDefaultOptsAndCb)(a, b);
        const filename = (0, util_1.pathToFilename)(path);
        this.wrapAsync(this.readlinkBase, [filename, opts.encoding], callback);
    }
    fsyncBase(fd) {
        this.getFileByFdOrThrow(fd, 'fsync');
    }
    fsyncSync(fd) {
        this.fsyncBase(fd);
    }
    fsync(fd, callback) {
        this.wrapAsync(this.fsyncBase, [fd], callback);
    }
    fdatasyncBase(fd) {
        this.getFileByFdOrThrow(fd, 'fdatasync');
    }
    fdatasyncSync(fd) {
        this.fdatasyncBase(fd);
    }
    fdatasync(fd, callback) {
        this.wrapAsync(this.fdatasyncBase, [fd], callback);
    }
    ftruncateBase(fd, len) {
        const file = this.getFileByFdOrThrow(fd, 'ftruncate');
        file.truncate(len);
    }
    ftruncateSync(fd, len) {
        this.ftruncateBase(fd, len);
    }
    ftruncate(fd, a, b) {
        const len = typeof a === 'number' ? a : 0;
        const callback = (0, util_1.validateCallback)(typeof a === 'number' ? b : a);
        this.wrapAsync(this.ftruncateBase, [fd, len], callback);
    }
    truncateBase(path, len) {
        const fd = this.openSync(path, 'r+');
        try {
            this.ftruncateSync(fd, len);
        }
        finally {
            this.closeSync(fd);
        }
    }
    /**
     * `id` should be a file descriptor or a path. `id` as file descriptor will
     * not be supported soon.
     */
    truncateSync(id, len) {
        if ((0, util_1.isFd)(id))
            return this.ftruncateSync(id, len);
        this.truncateBase(id, len);
    }
    truncate(id, a, b) {
        const len = typeof a === 'number' ? a : 0;
        const callback = (0, util_1.validateCallback)(typeof a === 'number' ? b : a);
        if ((0, util_1.isFd)(id))
            return this.ftruncate(id, len, callback);
        this.wrapAsync(this.truncateBase, [id, len], callback);
    }
    futimesBase(fd, atime, mtime) {
        const file = this.getFileByFdOrThrow(fd, 'futimes');
        const node = file.node;
        node.atime = new Date(atime * 1000);
        node.mtime = new Date(mtime * 1000);
    }
    futimesSync(fd, atime, mtime) {
        this.futimesBase(fd, toUnixTimestamp(atime), toUnixTimestamp(mtime));
    }
    futimes(fd, atime, mtime, callback) {
        this.wrapAsync(this.futimesBase, [fd, toUnixTimestamp(atime), toUnixTimestamp(mtime)], callback);
    }
    utimesBase(filename, atime, mtime, followSymlinks = true) {
        const link = followSymlinks
            ? this.getResolvedLinkOrThrow(filename, 'utimes')
            : this.getLinkOrThrow(filename, 'lutimes');
        const node = link.getNode();
        node.atime = new Date(atime * 1000);
        node.mtime = new Date(mtime * 1000);
    }
    utimesSync(path, atime, mtime) {
        this.utimesBase((0, util_1.pathToFilename)(path), toUnixTimestamp(atime), toUnixTimestamp(mtime), true);
    }
    utimes(path, atime, mtime, callback) {
        this.wrapAsync(this.utimesBase, [(0, util_1.pathToFilename)(path), toUnixTimestamp(atime), toUnixTimestamp(mtime), true], callback);
    }
    lutimesSync(path, atime, mtime) {
        this.utimesBase((0, util_1.pathToFilename)(path), toUnixTimestamp(atime), toUnixTimestamp(mtime), false);
    }
    lutimes(path, atime, mtime, callback) {
        this.wrapAsync(this.utimesBase, [(0, util_1.pathToFilename)(path), toUnixTimestamp(atime), toUnixTimestamp(mtime), false], callback);
    }
    mkdirBase(filename, modeNum) {
        const steps = filenameToSteps(filename);
        // This will throw if user tries to create root dir `fs.mkdirSync('/')`.
        if (!steps.length) {
            throw (0, util_1.createError)(EEXIST, 'mkdir', filename);
        }
        const dir = this.getLinkParentAsDirOrThrow(filename, 'mkdir');
        // Check path already exists.
        const name = steps[steps.length - 1];
        if (dir.getChild(name))
            throw (0, util_1.createError)(EEXIST, 'mkdir', filename);
        const node = dir.getNode();
        if (!node.canWrite() || !node.canExecute())
            throw (0, util_1.createError)(EACCES, 'mkdir', filename);
        dir.createChild(name, this.createNode(constants_1.constants.S_IFDIR | modeNum));
    }
    /**
     * Creates directory tree recursively.
     */
    mkdirpBase(filename, modeNum) {
        let created = false;
        const steps = filenameToSteps(filename);
        let curr = null;
        let i = steps.length;
        // Find the longest subpath of filename that still exists:
        for (i = steps.length; i >= 0; i--) {
            curr = this.getResolvedLink(steps.slice(0, i));
            if (curr)
                break;
        }
        if (!curr) {
            curr = this.root;
            i = 0;
        }
        // curr is now the last directory that still exists.
        // (If none of them existed, curr is the root.)
        // Check access the lazy way:
        curr = this.getResolvedLinkOrThrow(sep + steps.slice(0, i).join(sep), 'mkdir');
        // Start creating directories:
        for (i; i < steps.length; i++) {
            const node = curr.getNode();
            if (node.isDirectory()) {
                // Check we have permissions
                if (!node.canExecute() || !node.canWrite())
                    throw (0, util_1.createError)(EACCES, 'mkdir', filename);
            }
            else {
                throw (0, util_1.createError)(ENOTDIR, 'mkdir', filename);
            }
            created = true;
            curr = curr.createChild(steps[i], this.createNode(constants_1.constants.S_IFDIR | modeNum));
        }
        return created ? filename : undefined;
    }
    mkdirSync(path, options) {
        const opts = (0, options_1.getMkdirOptions)(options);
        const modeNum = (0, util_1.modeToNumber)(opts.mode, 0o777);
        const filename = (0, util_1.pathToFilename)(path);
        if (opts.recursive)
            return this.mkdirpBase(filename, modeNum);
        this.mkdirBase(filename, modeNum);
    }
    mkdir(path, a, b) {
        const opts = (0, options_1.getMkdirOptions)(a);
        const callback = (0, util_1.validateCallback)(typeof a === 'function' ? a : b);
        const modeNum = (0, util_1.modeToNumber)(opts.mode, 0o777);
        const filename = (0, util_1.pathToFilename)(path);
        if (opts.recursive)
            this.wrapAsync(this.mkdirpBase, [filename, modeNum], callback);
        else
            this.wrapAsync(this.mkdirBase, [filename, modeNum], callback);
    }
    mkdtempBase(prefix, encoding, retry = 5) {
        const filename = prefix + (0, util_1.genRndStr6)();
        try {
            this.mkdirBase(filename, 511 /* MODE.DIR */);
            return (0, encoding_1.strToEncoding)(filename, encoding);
        }
        catch (err) {
            if (err.code === EEXIST) {
                if (retry > 1)
                    return this.mkdtempBase(prefix, encoding, retry - 1);
                else
                    throw Error('Could not create temp dir.');
            }
            else
                throw err;
        }
    }
    mkdtempSync(prefix, options) {
        const { encoding } = (0, options_1.getDefaultOpts)(options);
        if (!prefix || typeof prefix !== 'string')
            throw new TypeError('filename prefix is required');
        (0, util_1.nullCheck)(prefix);
        return this.mkdtempBase(prefix, encoding);
    }
    mkdtemp(prefix, a, b) {
        const [{ encoding }, callback] = (0, options_1.getDefaultOptsAndCb)(a, b);
        if (!prefix || typeof prefix !== 'string')
            throw new TypeError('filename prefix is required');
        if (!(0, util_1.nullCheck)(prefix))
            return;
        this.wrapAsync(this.mkdtempBase, [prefix, encoding], callback);
    }
    rmdirBase(filename, options) {
        const opts = (0, options_1.getRmdirOptions)(options);
        const link = this.getLinkAsDirOrThrow(filename, 'rmdir');
        // Check directory is empty.
        if (link.length && !opts.recursive)
            throw (0, util_1.createError)(ENOTEMPTY, 'rmdir', filename);
        this.deleteLink(link);
    }
    rmdirSync(path, options) {
        this.rmdirBase((0, util_1.pathToFilename)(path), options);
    }
    rmdir(path, a, b) {
        const opts = (0, options_1.getRmdirOptions)(a);
        const callback = (0, util_1.validateCallback)(typeof a === 'function' ? a : b);
        this.wrapAsync(this.rmdirBase, [(0, util_1.pathToFilename)(path), opts], callback);
    }
    rmBase(filename, options = {}) {
        // "stat" is used to match Node's native error message.
        let link;
        try {
            link = this.getResolvedLinkOrThrow(filename, 'stat');
        }
        catch (err) {
            // Silently ignore missing paths if force option is true
            if (err.code === ENOENT && options.force)
                return;
            else
                throw err;
        }
        if (link.getNode().isDirectory() && !options.recursive)
            throw (0, util_1.createError)(ERR_FS_EISDIR, 'rm', filename);
        // Check permissions
        if (!link.parent.getNode().canWrite())
            throw (0, util_1.createError)(EACCES, 'rm', filename);
        this.deleteLink(link);
    }
    rmSync(path, options) {
        this.rmBase((0, util_1.pathToFilename)(path), options);
    }
    rm(path, a, b) {
        const [opts, callback] = (0, options_1.getRmOptsAndCb)(a, b);
        this.wrapAsync(this.rmBase, [(0, util_1.pathToFilename)(path), opts], callback);
    }
    fchmodBase(fd, modeNum) {
        const file = this.getFileByFdOrThrow(fd, 'fchmod');
        file.chmod(modeNum);
    }
    fchmodSync(fd, mode) {
        this.fchmodBase(fd, (0, util_1.modeToNumber)(mode));
    }
    fchmod(fd, mode, callback) {
        this.wrapAsync(this.fchmodBase, [fd, (0, util_1.modeToNumber)(mode)], callback);
    }
    chmodBase(filename, modeNum, followSymlinks = true) {
        const link = followSymlinks
            ? this.getResolvedLinkOrThrow(filename, 'chmod')
            : this.getLinkOrThrow(filename, 'chmod');
        const node = link.getNode();
        node.chmod(modeNum);
    }
    chmodSync(path, mode) {
        const modeNum = (0, util_1.modeToNumber)(mode);
        const filename = (0, util_1.pathToFilename)(path);
        this.chmodBase(filename, modeNum, true);
    }
    chmod(path, mode, callback) {
        const modeNum = (0, util_1.modeToNumber)(mode);
        const filename = (0, util_1.pathToFilename)(path);
        this.wrapAsync(this.chmodBase, [filename, modeNum], callback);
    }
    lchmodBase(filename, modeNum) {
        this.chmodBase(filename, modeNum, false);
    }
    lchmodSync(path, mode) {
        const modeNum = (0, util_1.modeToNumber)(mode);
        const filename = (0, util_1.pathToFilename)(path);
        this.lchmodBase(filename, modeNum);
    }
    lchmod(path, mode, callback) {
        const modeNum = (0, util_1.modeToNumber)(mode);
        const filename = (0, util_1.pathToFilename)(path);
        this.wrapAsync(this.lchmodBase, [filename, modeNum], callback);
    }
    fchownBase(fd, uid, gid) {
        this.getFileByFdOrThrow(fd, 'fchown').chown(uid, gid);
    }
    fchownSync(fd, uid, gid) {
        validateUid(uid);
        validateGid(gid);
        this.fchownBase(fd, uid, gid);
    }
    fchown(fd, uid, gid, callback) {
        validateUid(uid);
        validateGid(gid);
        this.wrapAsync(this.fchownBase, [fd, uid, gid], callback);
    }
    chownBase(filename, uid, gid) {
        const link = this.getResolvedLinkOrThrow(filename, 'chown');
        const node = link.getNode();
        node.chown(uid, gid);
        // if(node.isFile() || node.isSymlink()) {
        //
        // } else if(node.isDirectory()) {
        //
        // } else {
        // TODO: What do we do here?
        // }
    }
    chownSync(path, uid, gid) {
        validateUid(uid);
        validateGid(gid);
        this.chownBase((0, util_1.pathToFilename)(path), uid, gid);
    }
    chown(path, uid, gid, callback) {
        validateUid(uid);
        validateGid(gid);
        this.wrapAsync(this.chownBase, [(0, util_1.pathToFilename)(path), uid, gid], callback);
    }
    lchownBase(filename, uid, gid) {
        this.getLinkOrThrow(filename, 'lchown').getNode().chown(uid, gid);
    }
    lchownSync(path, uid, gid) {
        validateUid(uid);
        validateGid(gid);
        this.lchownBase((0, util_1.pathToFilename)(path), uid, gid);
    }
    lchown(path, uid, gid, callback) {
        validateUid(uid);
        validateGid(gid);
        this.wrapAsync(this.lchownBase, [(0, util_1.pathToFilename)(path), uid, gid], callback);
    }
    watchFile(path, a, b) {
        const filename = (0, util_1.pathToFilename)(path);
        let options = a;
        let listener = b;
        if (typeof options === 'function') {
            listener = a;
            options = null;
        }
        if (typeof listener !== 'function') {
            throw Error('"watchFile()" requires a listener function');
        }
        let interval = 5007;
        let persistent = true;
        if (options && typeof options === 'object') {
            if (typeof options.interval === 'number')
                interval = options.interval;
            if (typeof options.persistent === 'boolean')
                persistent = options.persistent;
        }
        let watcher = this.statWatchers[filename];
        if (!watcher) {
            watcher = new this.StatWatcher();
            watcher.start(filename, persistent, interval);
            this.statWatchers[filename] = watcher;
        }
        watcher.addListener('change', listener);
        return watcher;
    }
    unwatchFile(path, listener) {
        const filename = (0, util_1.pathToFilename)(path);
        const watcher = this.statWatchers[filename];
        if (!watcher)
            return;
        if (typeof listener === 'function') {
            watcher.removeListener('change', listener);
        }
        else {
            watcher.removeAllListeners('change');
        }
        if (watcher.listenerCount('change') === 0) {
            watcher.stop();
            delete this.statWatchers[filename];
        }
    }
    createReadStream(path, options) {
        return new this.ReadStream(path, options);
    }
    createWriteStream(path, options) {
        return new this.WriteStream(path, options);
    }
    // watch(path: PathLike): FSWatcher;
    // watch(path: PathLike, options?: IWatchOptions | string): FSWatcher;
    watch(path, options, listener) {
        const filename = (0, util_1.pathToFilename)(path);
        let givenOptions = options;
        if (typeof options === 'function') {
            listener = options;
            givenOptions = null;
        }
        // tslint:disable-next-line prefer-const
        let { persistent, recursive, encoding } = (0, options_1.getDefaultOpts)(givenOptions);
        if (persistent === undefined)
            persistent = true;
        if (recursive === undefined)
            recursive = false;
        const watcher = new this.FSWatcher();
        watcher.start(filename, persistent, recursive, encoding);
        if (listener) {
            watcher.addListener('change', listener);
        }
        return watcher;
    }
    opendirBase(filename, options) {
        const link = this.getResolvedLinkOrThrow(filename, 'scandir');
        const node = link.getNode();
        if (!node.isDirectory())
            throw (0, util_1.createError)(ENOTDIR, 'scandir', filename);
        return new Dir_1.Dir(link, options);
    }
    opendirSync(path, options) {
        const opts = (0, options_1.getOpendirOptions)(options);
        const filename = (0, util_1.pathToFilename)(path);
        return this.opendirBase(filename, opts);
    }
    opendir(path, a, b) {
        const [options, callback] = (0, options_1.getOpendirOptsAndCb)(a, b);
        const filename = (0, util_1.pathToFilename)(path);
        this.wrapAsync(this.opendirBase, [filename, options], callback);
    }
}
exports.Volume = Volume;
/**
 * Global file descriptor counter. UNIX file descriptors start from 0 and go sequentially
 * up, so here, in order not to conflict with them, we choose some big number and descrease
 * the file descriptor of every new opened file.
 * @type {number}
 * @todo This should not be static, right?
 */
Volume.fd = 0x7fffffff;
function emitStop(self) {
    self.emit('stop');
}
class StatWatcher extends events_1.EventEmitter {
    constructor(vol) {
        super();
        this.onInterval = () => {
            try {
                const stats = this.vol.statSync(this.filename);
                if (this.hasChanged(stats)) {
                    this.emit('change', stats, this.prev);
                    this.prev = stats;
                }
            }
            finally {
                this.loop();
            }
        };
        this.vol = vol;
    }
    loop() {
        this.timeoutRef = this.setTimeout(this.onInterval, this.interval);
    }
    hasChanged(stats) {
        // if(!this.prev) return false;
        if (stats.mtimeMs > this.prev.mtimeMs)
            return true;
        if (stats.nlink !== this.prev.nlink)
            return true;
        return false;
    }
    start(path, persistent = true, interval = 5007) {
        this.filename = (0, util_1.pathToFilename)(path);
        this.setTimeout = persistent
            ? setTimeout.bind(typeof globalThis !== 'undefined' ? globalThis : __webpack_require__.g)
            : setTimeoutUnref_1.default;
        this.interval = interval;
        this.prev = this.vol.statSync(this.filename);
        this.loop();
    }
    stop() {
        clearTimeout(this.timeoutRef);
        (0, queueMicrotask_1.default)(() => {
            emitStop.call(this, this);
        });
    }
}
exports.StatWatcher = StatWatcher;
/* tslint:disable no-var-keyword prefer-const */
// ---------------------------------------- ReadStream
var pool;
function allocNewPool(poolSize) {
    pool = (0, buffer_1.bufferAllocUnsafe)(poolSize);
    pool.used = 0;
}
util.inherits(FsReadStream, stream_1.Readable);
exports.ReadStream = FsReadStream;
function FsReadStream(vol, path, options) {
    if (!(this instanceof FsReadStream))
        return new FsReadStream(vol, path, options);
    this._vol = vol;
    // a little bit bigger buffer and water marks by default
    options = Object.assign({}, (0, options_1.getOptions)(options, {}));
    if (options.highWaterMark === undefined)
        options.highWaterMark = 64 * 1024;
    stream_1.Readable.call(this, options);
    this.path = (0, util_1.pathToFilename)(path);
    this.fd = options.fd === undefined ? null : typeof options.fd !== 'number' ? options.fd.fd : options.fd;
    this.flags = options.flags === undefined ? 'r' : options.flags;
    this.mode = options.mode === undefined ? 0o666 : options.mode;
    this.start = options.start;
    this.end = options.end;
    this.autoClose = options.autoClose === undefined ? true : options.autoClose;
    this.pos = undefined;
    this.bytesRead = 0;
    if (this.start !== undefined) {
        if (typeof this.start !== 'number') {
            throw new TypeError('"start" option must be a Number');
        }
        if (this.end === undefined) {
            this.end = Infinity;
        }
        else if (typeof this.end !== 'number') {
            throw new TypeError('"end" option must be a Number');
        }
        if (this.start > this.end) {
            throw new Error('"start" option must be <= "end" option');
        }
        this.pos = this.start;
    }
    if (typeof this.fd !== 'number')
        this.open();
    this.on('end', function () {
        if (this.autoClose) {
            if (this.destroy)
                this.destroy();
        }
    });
}
FsReadStream.prototype.open = function () {
    var self = this; // tslint:disable-line no-this-assignment
    this._vol.open(this.path, this.flags, this.mode, (er, fd) => {
        if (er) {
            if (self.autoClose) {
                if (self.destroy)
                    self.destroy();
            }
            self.emit('error', er);
            return;
        }
        self.fd = fd;
        self.emit('open', fd);
        // start the flow of data.
        self.read();
    });
};
FsReadStream.prototype._read = function (n) {
    if (typeof this.fd !== 'number') {
        return this.once('open', function () {
            this._read(n);
        });
    }
    if (this.destroyed)
        return;
    if (!pool || pool.length - pool.used < kMinPoolSpace) {
        // discard the old pool.
        allocNewPool(this._readableState.highWaterMark);
    }
    // Grab another reference to the pool in the case that while we're
    // in the thread pool another read() finishes up the pool, and
    // allocates a new one.
    var thisPool = pool;
    var toRead = Math.min(pool.length - pool.used, n);
    var start = pool.used;
    if (this.pos !== undefined)
        toRead = Math.min(this.end - this.pos + 1, toRead);
    // already read everything we were supposed to read!
    // treat as EOF.
    if (toRead <= 0)
        return this.push(null);
    // the actual read.
    var self = this; // tslint:disable-line no-this-assignment
    this._vol.read(this.fd, pool, pool.used, toRead, this.pos, onread);
    // move the pool positions, and internal position for reading.
    if (this.pos !== undefined)
        this.pos += toRead;
    pool.used += toRead;
    function onread(er, bytesRead) {
        if (er) {
            if (self.autoClose && self.destroy) {
                self.destroy();
            }
            self.emit('error', er);
        }
        else {
            var b = null;
            if (bytesRead > 0) {
                self.bytesRead += bytesRead;
                b = thisPool.slice(start, start + bytesRead);
            }
            self.push(b);
        }
    }
};
FsReadStream.prototype._destroy = function (err, cb) {
    this.close(err2 => {
        cb(err || err2);
    });
};
FsReadStream.prototype.close = function (cb) {
    var _a;
    if (cb)
        this.once('close', cb);
    if (this.closed || typeof this.fd !== 'number') {
        if (typeof this.fd !== 'number') {
            this.once('open', closeOnOpen);
            return;
        }
        return (0, queueMicrotask_1.default)(() => this.emit('close'));
    }
    // Since Node 18, there is only a getter for '.closed'.
    // The first branch mimics other setters from Readable.
    // See https://github.com/nodejs/node/blob/v18.0.0/lib/internal/streams/readable.js#L1243
    if (typeof ((_a = this._readableState) === null || _a === void 0 ? void 0 : _a.closed) === 'boolean') {
        this._readableState.closed = true;
    }
    else {
        this.closed = true;
    }
    this._vol.close(this.fd, er => {
        if (er)
            this.emit('error', er);
        else
            this.emit('close');
    });
    this.fd = null;
};
// needed because as it will be called with arguments
// that does not match this.close() signature
function closeOnOpen(fd) {
    this.close();
}
util.inherits(FsWriteStream, stream_1.Writable);
exports.WriteStream = FsWriteStream;
function FsWriteStream(vol, path, options) {
    if (!(this instanceof FsWriteStream))
        return new FsWriteStream(vol, path, options);
    this._vol = vol;
    options = Object.assign({}, (0, options_1.getOptions)(options, {}));
    stream_1.Writable.call(this, options);
    this.path = (0, util_1.pathToFilename)(path);
    this.fd = options.fd === undefined ? null : typeof options.fd !== 'number' ? options.fd.fd : options.fd;
    this.flags = options.flags === undefined ? 'w' : options.flags;
    this.mode = options.mode === undefined ? 0o666 : options.mode;
    this.start = options.start;
    this.autoClose = options.autoClose === undefined ? true : !!options.autoClose;
    this.pos = undefined;
    this.bytesWritten = 0;
    this.pending = true;
    if (this.start !== undefined) {
        if (typeof this.start !== 'number') {
            throw new TypeError('"start" option must be a Number');
        }
        if (this.start < 0) {
            throw new Error('"start" must be >= zero');
        }
        this.pos = this.start;
    }
    if (options.encoding)
        this.setDefaultEncoding(options.encoding);
    if (typeof this.fd !== 'number')
        this.open();
    // dispose on finish.
    this.once('finish', function () {
        if (this.autoClose) {
            this.close();
        }
    });
}
FsWriteStream.prototype.open = function () {
    this._vol.open(this.path, this.flags, this.mode, function (er, fd) {
        if (er) {
            if (this.autoClose && this.destroy) {
                this.destroy();
            }
            this.emit('error', er);
            return;
        }
        this.fd = fd;
        this.pending = false;
        this.emit('open', fd);
    }.bind(this));
};
FsWriteStream.prototype._write = function (data, encoding, cb) {
    if (!(data instanceof buffer_1.Buffer || data instanceof Uint8Array))
        return this.emit('error', new Error('Invalid data'));
    if (typeof this.fd !== 'number') {
        return this.once('open', function () {
            this._write(data, encoding, cb);
        });
    }
    var self = this; // tslint:disable-line no-this-assignment
    this._vol.write(this.fd, data, 0, data.length, this.pos, (er, bytes) => {
        if (er) {
            if (self.autoClose && self.destroy) {
                self.destroy();
            }
            return cb(er);
        }
        self.bytesWritten += bytes;
        cb();
    });
    if (this.pos !== undefined)
        this.pos += data.length;
};
FsWriteStream.prototype._writev = function (data, cb) {
    if (typeof this.fd !== 'number') {
        return this.once('open', function () {
            this._writev(data, cb);
        });
    }
    const self = this; // tslint:disable-line no-this-assignment
    const len = data.length;
    const chunks = new Array(len);
    var size = 0;
    for (var i = 0; i < len; i++) {
        var chunk = data[i].chunk;
        chunks[i] = chunk;
        size += chunk.length;
    }
    const buf = buffer_1.Buffer.concat(chunks);
    this._vol.write(this.fd, buf, 0, buf.length, this.pos, (er, bytes) => {
        if (er) {
            if (self.destroy)
                self.destroy();
            return cb(er);
        }
        self.bytesWritten += bytes;
        cb();
    });
    if (this.pos !== undefined)
        this.pos += size;
};
FsWriteStream.prototype.close = function (cb) {
    var _a;
    if (cb)
        this.once('close', cb);
    if (this.closed || typeof this.fd !== 'number') {
        if (typeof this.fd !== 'number') {
            this.once('open', closeOnOpen);
            return;
        }
        return (0, queueMicrotask_1.default)(() => this.emit('close'));
    }
    // Since Node 18, there is only a getter for '.closed'.
    // The first branch mimics other setters from Writable.
    // See https://github.com/nodejs/node/blob/v18.0.0/lib/internal/streams/writable.js#L766
    if (typeof ((_a = this._writableState) === null || _a === void 0 ? void 0 : _a.closed) === 'boolean') {
        this._writableState.closed = true;
    }
    else {
        this.closed = true;
    }
    this._vol.close(this.fd, er => {
        if (er)
            this.emit('error', er);
        else
            this.emit('close');
    });
    this.fd = null;
};
FsWriteStream.prototype._destroy = FsReadStream.prototype._destroy;
// There is no shutdown() for files.
FsWriteStream.prototype.destroySoon = FsWriteStream.prototype.end;
// ---------------------------------------- FSWatcher
class FSWatcher extends events_1.EventEmitter {
    constructor(vol) {
        super();
        this._filename = '';
        this._filenameEncoded = '';
        // _persistent: boolean = true;
        this._recursive = false;
        this._encoding = encoding_1.ENCODING_UTF8;
        // inode -> removers
        this._listenerRemovers = new Map();
        this._onParentChild = (link) => {
            if (link.getName() === this._getName()) {
                this._emit('rename');
            }
        };
        this._emit = (type) => {
            this.emit('change', type, this._filenameEncoded);
        };
        this._persist = () => {
            this._timer = setTimeout(this._persist, 1e6);
        };
        this._vol = vol;
        // TODO: Emit "error" messages when watching.
        // this._handle.onchange = function(status, eventType, filename) {
        //     if (status < 0) {
        //         self._handle.close();
        //         const error = !filename ?
        //             errnoException(status, 'Error watching file for changes:') :
        //             errnoException(status, `Error watching file ${filename} for changes:`);
        //         error.filename = filename;
        //         self.emit('error', error);
        //     } else {
        //         self.emit('change', eventType, filename);
        //     }
        // };
    }
    _getName() {
        return this._steps[this._steps.length - 1];
    }
    start(path, persistent = true, recursive = false, encoding = encoding_1.ENCODING_UTF8) {
        this._filename = (0, util_1.pathToFilename)(path);
        this._steps = filenameToSteps(this._filename);
        this._filenameEncoded = (0, encoding_1.strToEncoding)(this._filename);
        // this._persistent = persistent;
        this._recursive = recursive;
        this._encoding = encoding;
        try {
            this._link = this._vol.getLinkOrThrow(this._filename, 'FSWatcher');
        }
        catch (err) {
            const error = new Error(`watch ${this._filename} ${err.code}`);
            error.code = err.code;
            error.errno = err.code;
            throw error;
        }
        const watchLinkNodeChanged = (link) => {
            var _a;
            const filepath = link.getPath();
            const node = link.getNode();
            const onNodeChange = () => {
                let filename = relative(this._filename, filepath);
                if (!filename) {
                    filename = this._getName();
                }
                return this.emit('change', 'change', filename);
            };
            node.on('change', onNodeChange);
            const removers = (_a = this._listenerRemovers.get(node.ino)) !== null && _a !== void 0 ? _a : [];
            removers.push(() => node.removeListener('change', onNodeChange));
            this._listenerRemovers.set(node.ino, removers);
        };
        const watchLinkChildrenChanged = (link) => {
            var _a;
            const node = link.getNode();
            // when a new link added
            const onLinkChildAdd = (l) => {
                this.emit('change', 'rename', relative(this._filename, l.getPath()));
                setTimeout(() => {
                    // 1. watch changes of the new link-node
                    watchLinkNodeChanged(l);
                    // 2. watch changes of the new link-node's children
                    watchLinkChildrenChanged(l);
                });
            };
            // when a new link deleted
            const onLinkChildDelete = (l) => {
                // remove the listeners of the children nodes
                const removeLinkNodeListeners = (curLink) => {
                    const ino = curLink.getNode().ino;
                    const removers = this._listenerRemovers.get(ino);
                    if (removers) {
                        removers.forEach(r => r());
                        this._listenerRemovers.delete(ino);
                    }
                    for (const [name, childLink] of curLink.children.entries()) {
                        if (childLink && name !== '.' && name !== '..') {
                            removeLinkNodeListeners(childLink);
                        }
                    }
                };
                removeLinkNodeListeners(l);
                this.emit('change', 'rename', relative(this._filename, l.getPath()));
            };
            // children nodes changed
            for (const [name, childLink] of link.children.entries()) {
                if (childLink && name !== '.' && name !== '..') {
                    watchLinkNodeChanged(childLink);
                }
            }
            // link children add/remove
            link.on('child:add', onLinkChildAdd);
            link.on('child:delete', onLinkChildDelete);
            const removers = (_a = this._listenerRemovers.get(node.ino)) !== null && _a !== void 0 ? _a : [];
            removers.push(() => {
                link.removeListener('child:add', onLinkChildAdd);
                link.removeListener('child:delete', onLinkChildDelete);
            });
            if (recursive) {
                for (const [name, childLink] of link.children.entries()) {
                    if (childLink && name !== '.' && name !== '..') {
                        watchLinkChildrenChanged(childLink);
                    }
                }
            }
        };
        watchLinkNodeChanged(this._link);
        watchLinkChildrenChanged(this._link);
        const parent = this._link.parent;
        if (parent) {
            // parent.on('child:add', this._onParentChild);
            parent.setMaxListeners(parent.getMaxListeners() + 1);
            parent.on('child:delete', this._onParentChild);
        }
        if (persistent)
            this._persist();
    }
    close() {
        clearTimeout(this._timer);
        this._listenerRemovers.forEach(removers => {
            removers.forEach(r => r());
        });
        this._listenerRemovers.clear();
        const parent = this._link.parent;
        if (parent) {
            // parent.removeListener('child:add', this._onParentChild);
            parent.removeListener('child:delete', this._onParentChild);
        }
    }
}
exports.FSWatcher = FSWatcher;


/***/ }),

/***/ 6982:
/***/ ((module) => {

"use strict";
module.exports = require("crypto");

/***/ }),

/***/ 7016:
/***/ ((module) => {

"use strict";
module.exports = require("url");

/***/ }),

/***/ 7189:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CompanionResourceInfoResponse = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const companion_resource_size_1 = __webpack_require__(1564);
class CompanionResourceInfoResponse {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsCompanionResourceInfoResponse(bb, obj) {
        return (obj || new CompanionResourceInfoResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsCompanionResourceInfoResponse(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new CompanionResourceInfoResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    requestId() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readUint32(this.bb_pos + offset) : 0;
    }
    contentType(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    resourceSizeType() {
        const offset = this.bb.__offset(this.bb_pos, 8);
        return offset ? this.bb.readUint8(this.bb_pos + offset) : companion_resource_size_1.CompanionResourceSize.NONE;
    }
    resourceSize(obj) {
        const offset = this.bb.__offset(this.bb_pos, 10);
        return offset ? this.bb.__union(obj, this.bb_pos + offset) : null;
    }
    static startCompanionResourceInfoResponse(builder) {
        builder.startObject(4);
    }
    static addRequestId(builder, requestId) {
        builder.addFieldInt32(0, requestId, 0);
    }
    static addContentType(builder, contentTypeOffset) {
        builder.addFieldOffset(1, contentTypeOffset, 0);
    }
    static addResourceSizeType(builder, resourceSizeType) {
        builder.addFieldInt8(2, resourceSizeType, companion_resource_size_1.CompanionResourceSize.NONE);
    }
    static addResourceSize(builder, resourceSizeOffset) {
        builder.addFieldOffset(3, resourceSizeOffset, 0);
    }
    static endCompanionResourceInfoResponse(builder) {
        const offset = builder.endObject();
        builder.requiredField(offset, 6); // content_type
        return offset;
    }
    static createCompanionResourceInfoResponse(builder, requestId, contentTypeOffset, resourceSizeType, resourceSizeOffset) {
        CompanionResourceInfoResponse.startCompanionResourceInfoResponse(builder);
        CompanionResourceInfoResponse.addRequestId(builder, requestId);
        CompanionResourceInfoResponse.addContentType(builder, contentTypeOffset);
        CompanionResourceInfoResponse.addResourceSizeType(builder, resourceSizeType);
        CompanionResourceInfoResponse.addResourceSize(builder, resourceSizeOffset);
        return CompanionResourceInfoResponse.endCompanionResourceInfoResponse(builder);
    }
}
exports.CompanionResourceInfoResponse = CompanionResourceInfoResponse;


/***/ }),

/***/ 7194:
/***/ ((module) => {

"use strict";
module.exports = require("dgram");

/***/ }),

/***/ 7204:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
/**
 * `setTimeoutUnref` is just like `setTimeout`,
 * only in Node's environment it will "unref" its macro task.
 */
function setTimeoutUnref(callback, time, args) {
    const ref = setTimeout.apply(typeof globalThis !== 'undefined' ? globalThis : __webpack_require__.g, arguments);
    if (ref && typeof ref === 'object' && typeof ref.unref === 'function')
        ref.unref();
    return ref;
}
exports["default"] = setTimeoutUnref;


/***/ }),

/***/ 7466:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MirroringSessionDescription = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class MirroringSessionDescription {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsMirroringSessionDescription(bb, obj) {
        return (obj || new MirroringSessionDescription()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsMirroringSessionDescription(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new MirroringSessionDescription()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    sessionId() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readUint16(this.bb_pos + offset) : 0;
    }
    sdp(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    static startMirroringSessionDescription(builder) {
        builder.startObject(2);
    }
    static addSessionId(builder, sessionId) {
        builder.addFieldInt16(0, sessionId, 0);
    }
    static addSdp(builder, sdpOffset) {
        builder.addFieldOffset(1, sdpOffset, 0);
    }
    static endMirroringSessionDescription(builder) {
        const offset = builder.endObject();
        builder.requiredField(offset, 6); // sdp
        return offset;
    }
    static createMirroringSessionDescription(builder, sessionId, sdpOffset) {
        MirroringSessionDescription.startMirroringSessionDescription(builder);
        MirroringSessionDescription.addSessionId(builder, sessionId);
        MirroringSessionDescription.addSdp(builder, sdpOffset);
        return MirroringSessionDescription.endMirroringSessionDescription(builder);
    }
}
exports.MirroringSessionDescription = MirroringSessionDescription;


/***/ }),

/***/ 7478:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

exports.toString = function (type) {
    switch (type) {
        case 1: return 'A';
        case 10: return 'NULL';
        case 28: return 'AAAA';
        case 18: return 'AFSDB';
        case 42: return 'APL';
        case 257: return 'CAA';
        case 60: return 'CDNSKEY';
        case 59: return 'CDS';
        case 37: return 'CERT';
        case 5: return 'CNAME';
        case 49: return 'DHCID';
        case 32769: return 'DLV';
        case 39: return 'DNAME';
        case 48: return 'DNSKEY';
        case 43: return 'DS';
        case 55: return 'HIP';
        case 13: return 'HINFO';
        case 45: return 'IPSECKEY';
        case 25: return 'KEY';
        case 36: return 'KX';
        case 29: return 'LOC';
        case 15: return 'MX';
        case 35: return 'NAPTR';
        case 2: return 'NS';
        case 47: return 'NSEC';
        case 50: return 'NSEC3';
        case 51: return 'NSEC3PARAM';
        case 12: return 'PTR';
        case 46: return 'RRSIG';
        case 17: return 'RP';
        case 24: return 'SIG';
        case 6: return 'SOA';
        case 99: return 'SPF';
        case 33: return 'SRV';
        case 44: return 'SSHFP';
        case 32768: return 'TA';
        case 249: return 'TKEY';
        case 52: return 'TLSA';
        case 250: return 'TSIG';
        case 16: return 'TXT';
        case 252: return 'AXFR';
        case 251: return 'IXFR';
        case 41: return 'OPT';
        case 255: return 'ANY';
    }
    return 'UNKNOWN_' + type;
};
exports.toType = function (name) {
    switch (name.toUpperCase()) {
        case 'A': return 1;
        case 'NULL': return 10;
        case 'AAAA': return 28;
        case 'AFSDB': return 18;
        case 'APL': return 42;
        case 'CAA': return 257;
        case 'CDNSKEY': return 60;
        case 'CDS': return 59;
        case 'CERT': return 37;
        case 'CNAME': return 5;
        case 'DHCID': return 49;
        case 'DLV': return 32769;
        case 'DNAME': return 39;
        case 'DNSKEY': return 48;
        case 'DS': return 43;
        case 'HIP': return 55;
        case 'HINFO': return 13;
        case 'IPSECKEY': return 45;
        case 'KEY': return 25;
        case 'KX': return 36;
        case 'LOC': return 29;
        case 'MX': return 15;
        case 'NAPTR': return 35;
        case 'NS': return 2;
        case 'NSEC': return 47;
        case 'NSEC3': return 50;
        case 'NSEC3PARAM': return 51;
        case 'PTR': return 12;
        case 'RRSIG': return 46;
        case 'RP': return 17;
        case 'SIG': return 24;
        case 'SOA': return 6;
        case 'SPF': return 99;
        case 'SRV': return 33;
        case 'SSHFP': return 44;
        case 'TA': return 32768;
        case 'TKEY': return 249;
        case 'TLSA': return 52;
        case 'TSIG': return 250;
        case 'TXT': return 16;
        case 'AXFR': return 252;
        case 'IXFR': return 251;
        case 'OPT': return 41;
        case 'ANY': return 255;
        case '*': return 255;
    }
    if (name.toUpperCase().startsWith('UNKNOWN_'))
        return parseInt(name.slice(8));
    return 0;
};


/***/ }),

/***/ 7548:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.QueuePosition = void 0;
exports.unionToQueuePosition = unionToQueuePosition;
exports.unionListToQueuePosition = unionListToQueuePosition;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const queue_index_1 = __webpack_require__(8535);
const queue_marker_back_1 = __webpack_require__(7825);
const queue_marker_front_1 = __webpack_require__(2119);
var QueuePosition;
(function (QueuePosition) {
    QueuePosition[QueuePosition["NONE"] = 0] = "NONE";
    QueuePosition[QueuePosition["Index"] = 1] = "Index";
    QueuePosition[QueuePosition["Front"] = 2] = "Front";
    QueuePosition[QueuePosition["Back"] = 3] = "Back";
})(QueuePosition || (exports.QueuePosition = QueuePosition = {}));
function unionToQueuePosition(type, accessor) {
    switch (QueuePosition[type]) {
        case 'NONE': return null;
        case 'Index': return accessor(new queue_index_1.QueueIndex());
        case 'Front': return accessor(new queue_marker_front_1.QueueMarkerFront());
        case 'Back': return accessor(new queue_marker_back_1.QueueMarkerBack());
        default: return null;
    }
}
function unionListToQueuePosition(type, accessor, index) {
    switch (QueuePosition[type]) {
        case 'NONE': return null;
        case 'Index': return accessor(index, new queue_index_1.QueueIndex());
        case 'Front': return accessor(index, new queue_marker_front_1.QueueMarkerFront());
        case 'Back': return accessor(index, new queue_marker_back_1.QueueMarkerBack());
        default: return null;
    }
}


/***/ }),

/***/ 7666:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MediaSession = exports.MIRRORING_CONTAINER = exports.MAX_QUEUE_LENGTH = void 0;
exports.contentViewerFor = contentViewerFor;
const Packets_1 = __webpack_require__(834);
const MediaCache_1 = __webpack_require__(529);
const NetworkService_1 = __webpack_require__(3530);
const MimeTypes_1 = __webpack_require__(8778);
const UtilityBackend_1 = __webpack_require__(8819);
const Logger_1 = __webpack_require__(1943);
const Codec_1 = __webpack_require__(3196);
const Probe_1 = __webpack_require__(3658);
const logger = new Logger_1.Logger('MediaSession', Logger_1.LoggerType.BACKEND);
// What is loaded on the receiver, and the rules the reference receiver (futo-org/fcast
// crates/receiver-core) applies to it: the queue is kept here, not in the pages, so queue
// requests are validated and relayed to other senders the same way. The pages play one item at a
// time and report back.
// v4 queue positions are ubytes.
exports.MAX_QUEUE_LENGTH = 256;
exports.MIRRORING_CONTAINER = 'application/x-fwebrtc';
// External subtitles get ids of their own, stable for the life of the item, well clear of the
// indices the pages give embedded tracks.
const FIRST_EXTERNAL_SUBTITLE_ID = 1000;
function contentViewerFor(container) {
    const type = (container || '').toLowerCase();
    if (type === exports.MIRRORING_CONTAINER || MimeTypes_1.supportedPlayerTypes.indexOf(type) >= 0) {
        return 'player';
    }
    // Images and anything else the player can't handle go to the viewer, like upstream.
    return MimeTypes_1.supportedImageTypes.indexOf(type) >= 0 ? 'viewer' : 'player';
}
function resolvePosition(position, length, forInsert) {
    switch (position.kind) {
        case 'front':
            return 0;
        case 'back':
            return forInsert ? length : length - 1;
        default:
            return position.index;
    }
}
function playMessageFromItem(item) {
    return new Packets_1.PlayMessage(item.container, item.url, item.content, item.time, item.volume, item.speed, item.headers, item.metadata);
}
function sameTracks(a, b) {
    return JSON.stringify(a && { tracks: a.tracks, selected: a.selected }) === JSON.stringify(b && { tracks: b.tracks, selected: b.selected });
}
class MediaSession {
    constructor(host) {
        this.host = host;
        this.nextLoadId = 1;
        this.loaded = null;
        this.mediaCache = null;
        this.playbackUpdate = null;
        this.volume = null;
        this.tracks = null;
        this.externals = [];
        this.nextExternalId = FIRST_EXTERNAL_SUBTITLE_ID;
        this.pendingLoadId = 0;
    }
    get listener() {
        return this.host.listener();
    }
    get isLoaded() {
        return this.loaded !== null;
    }
    // Handles what senders ask for: the events of a ListenerService.
    bind(emitter, mirroringSupported) {
        const on = (event, handler) => {
            emitter.on(event, (...args) => {
                try {
                    handler(...args);
                }
                catch (e) {
                    logger.error(`Handling '${event}' failed`, e);
                }
            });
        };
        on('play', (message, origin) => this.load(message, origin).catch((e) => logger.error('Load failed', e)));
        on('pause', () => this.pause());
        on('resume', () => this.resume());
        on('stop', (origin) => this.stop(origin));
        on('seek', (message, origin) => this.seek(message.time, origin));
        on('setvolume', (message) => this.setVolume(message.volume));
        on('setspeed', (message) => this.setSpeed(message.speed));
        on('setplaylistitem', (message, origin) => this.setPlaylistItem(message.itemIndex, origin));
        on('queueselect', (message, origin) => this.queueSelect(message.position, origin));
        on('queueinsert', (message, origin) => this.queueInsert(message.item, message.position, origin));
        on('queueremove', (message, origin) => this.queueRemove(message.position, origin));
        on('changetrack', (message, origin) => this.changeTrack(message.trackType, message.id, origin));
        on('addsubtitle', (message, origin) => this.addSubtitle(message.url, message.select, message.name, origin));
        on('mirroringstart', (_message, origin) => this.startMirroring(origin, mirroringSupported()));
        on('mirroringoffer', (message, origin) => this.mirroringOffer(message.sdp, origin));
        on('companionhello', (origin) => {
            var _a;
            const provider = this.host.companion.register(origin.sessionId);
            (_a = this.listener.getSession(origin.sessionId)) === null || _a === void 0 ? void 0 : _a.sendCompanionHelloResponse(provider);
        });
        on('disconnect', (message) => {
            this.host.companion.unregister(message.sessionId);
            this.onSenderGone(message.sessionId);
        });
    }
    // ---- Loading ------------------------------------------------------------------------------
    async load(message, origin) {
        var _a;
        const loadId = this.nextLoadId++;
        // A load replaces whatever was loading before it finished preparing.
        this.pendingLoadId = loadId;
        let playlist = null;
        if (message.container === Codec_1.PLAYLIST_CONTAINER) {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any -- JSON
                const json = message.url ? await (0, UtilityBackend_1.fetchJSON)(this.host.companion.rewriteUrl(message.url)) : JSON.parse(message.content);
                if (json && json.contentType === Packets_1.ContentType.Playlist && Array.isArray(json.items)) {
                    playlist = json;
                }
            }
            catch (e) {
                logger.warn('Could not load the playlist', e);
                this.reportLoadError(origin, message.url ? Codec_1.ErrorKind.ResourceNotFound : Codec_1.ErrorKind.MalformedBody, `Could not load the playlist: ${e}`);
                return;
            }
            if (this.pendingLoadId !== loadId) {
                return;
            }
        }
        let queue = null;
        if (playlist !== null) {
            const index = playlist.offset !== null && playlist.offset !== undefined ? playlist.offset : 0;
            if (playlist.items.length > exports.MAX_QUEUE_LENGTH) {
                this.reportLoadError(origin, Codec_1.ErrorKind.MalformedBody, 'The playlist is too long');
                return;
            }
            if (playlist.items.length === 0 || index < 0 || index >= playlist.items.length) {
                this.reportLoadError(origin, Codec_1.ErrorKind.QueuePositionOutOfRange, 'The playlist start position does not exist');
                return;
            }
            queue = {
                items: playlist.items.slice(),
                index: index,
                // v3 playlists always advance.
                autoplay: playlist.autoplay !== undefined && playlist.autoplay !== null ? playlist.autoplay : true,
                playlist: playlist,
            };
        }
        this.resetItemState();
        (_a = this.mediaCache) === null || _a === void 0 ? void 0 : _a.destroy();
        this.mediaCache = null;
        const loaded = {
            loadId: loadId,
            origin: origin,
            message: message,
            queue: queue,
            mirroring: null,
            singlePlayInfo: null,
            viewer: contentViewerFor(queue ? queue.items[queue.index].container : message.container),
        };
        this.relayLoad(loaded, origin);
        if (queue) {
            this.mediaCache = new MediaCache_1.MediaCache(this.pagePlaylist(queue));
        }
        else {
            const pageMessage = this.pageMessage(message);
            const proxyUrl = await NetworkService_1.NetworkService.proxyPlayIfRequired(pageMessage);
            if (this.pendingLoadId !== loadId) {
                return;
            }
            loaded.singlePlayInfo = {
                loadId: loadId,
                rendererEvent: 'play',
                rendererMessage: pageMessage,
                proxyUrl: proxyUrl,
                contentViewer: loaded.viewer,
                playerVolume: this.volume,
            };
        }
        this.loaded = loaded;
        this.host.page('load', this.playInfo());
        this.host.ensurePage();
    }
    // Other senders learn what was loaded: v3 as `PlayUpdate`, v4 as a `Load` without request
    // headers (so credentials aren't shared), except to the sender that loaded it.
    relayLoad(loaded, origin) {
        this.listener.send(Packets_1.Opcode.PlayUpdate, new Packets_1.PlayUpdateMessage(Date.now(), loaded.message));
        const source = this.loadSourceOf(loaded);
        if (source) {
            this.listener.sendV4(() => (0, Codec_1.encodeLoadSource)(source), { exclude: origin ? origin.sessionId : undefined });
        }
    }
    loadSourceOf(loaded) {
        if (loaded.mirroring) {
            return null;
        }
        if (loaded.queue) {
            return { kind: 'queue', items: loaded.queue.items, index: loaded.queue.index, autoplay: loaded.queue.autoplay };
        }
        return { kind: 'single', message: loaded.message };
    }
    // For senders that join mid-playback.
    v4LoadSource() {
        return this.loaded ? this.loadSourceOf(this.loaded) : null;
    }
    // What v3 senders get in `Initial`.
    currentPlayMessage() {
        if (!this.loaded || this.loaded.mirroring) {
            return null;
        }
        const message = this.loaded.message;
        return this.playbackUpdate === null ? message : {
            ...message,
            time: this.playbackUpdate.time,
            volume: this.volume,
            speed: this.playbackUpdate.speed,
        };
    }
    // ---- What the pages see -------------------------------------------------------------------
    rewrite(value) {
        return value ? this.host.companion.rewriteUrl(value) : value;
    }
    pageMetadata(metadata) {
        if (metadata && metadata.type === Packets_1.MetadataType.Generic && metadata.thumbnailUrl) {
            return { ...metadata, thumbnailUrl: this.rewrite(metadata.thumbnailUrl) };
        }
        return metadata;
    }
    pageMessage(message) {
        return { ...message, url: this.rewrite(message.url), metadata: this.pageMetadata(message.metadata) };
    }
    pageItem(item) {
        return { ...item, url: this.rewrite(item.url), metadata: this.pageMetadata(item.metadata) };
    }
    pagePlaylist(queue) {
        return {
            ...queue.playlist,
            contentType: Packets_1.ContentType.Playlist,
            items: queue.items.map((item) => this.pageItem(item)),
            offset: queue.index,
            autoplay: queue.autoplay,
        };
    }
    playInfo() {
        const loaded = this.loaded;
        if (!loaded) {
            return null;
        }
        if (!loaded.queue) {
            return loaded.singlePlayInfo ? { ...loaded.singlePlayInfo, playerVolume: this.volume } : null;
        }
        return {
            loadId: loaded.loadId,
            rendererEvent: 'play-playlist',
            rendererMessage: this.pagePlaylist(loaded.queue),
            proxyUrl: null,
            contentViewer: contentViewerFor(loaded.queue.items[loaded.queue.index].container),
            playerVolume: this.volume,
        };
    }
    // Replayed to a page that just (re)connected, after `device_info`.
    replay(send) {
        const info = this.playInfo();
        if (info) {
            send('load', info);
            if (this.loaded.mirroring && this.loaded.mirroring.offer) {
                send('mirroring_offer', { loadId: this.loaded.loadId, sdp: this.loaded.mirroring.offer });
            }
        }
    }
    queueUpdate() {
        const queue = this.loaded.queue;
        return { loadId: this.loaded.loadId, items: queue.items.map((item) => this.pageItem(item)), index: queue.index, autoplay: queue.autoplay };
    }
    // ---- Queue ----------------------------------------------------------------------------------
    // The player asks to play queue item `index`: after a load, on the TV's previous/next keys,
    // on autoplay, or after we asked it to (`setplaylistitem`).
    async playRequest(loadId, index) {
        var _a;
        const loaded = this.loaded;
        if (!loaded || loaded.loadId !== loadId || !loaded.queue || index < 0 || index >= loaded.queue.items.length) {
            logger.info(`Ignoring a play request for item ${index} of load ${loadId}`);
            return;
        }
        const queue = loaded.queue;
        if (index !== queue.index) {
            // Chosen on the TV or by autoplay: every v4 sender hears about it.
            queue.index = index;
            this.resetItemState();
            this.listener.sendV4(() => (0, Codec_1.encodeQueueItemSelected)(index));
        }
        const item = queue.items[index];
        this.listener.send(Packets_1.Opcode.PlayUpdate, new Packets_1.PlayUpdateMessage(Date.now(), playMessageFromItem(item)));
        const message = playMessageFromItem(this.pageItem(item));
        if (this.mediaCache && this.mediaCache.has(index)) {
            message.url = this.mediaCache.getUrl(index);
        }
        (_a = this.mediaCache) === null || _a === void 0 ? void 0 : _a.cacheItems(index);
        const proxyUrl = await NetworkService_1.NetworkService.proxyPlayIfRequired(message);
        if (this.loaded !== loaded || queue.index !== index) {
            return;
        }
        loaded.viewer = contentViewerFor(item.container);
        const info = {
            loadId: loaded.loadId,
            index: index,
            message: message,
            proxyUrl: proxyUrl,
            contentViewer: loaded.viewer,
            playerVolume: this.volume,
        };
        this.host.page('item', info);
    }
    requireQueue(origin) {
        const queue = this.loaded ? this.loaded.queue : null;
        if (!queue) {
            logger.warn('Queue request without a queue');
            this.listener.sendV4Error(origin, Codec_1.ErrorKind.InvalidState);
        }
        return queue;
    }
    // Queue changes can't go through the media cache, which is indexed by position.
    dropMediaCache() {
        var _a;
        (_a = this.mediaCache) === null || _a === void 0 ? void 0 : _a.destroy();
        this.mediaCache = null;
    }
    queueSelect(position, origin) {
        const queue = this.requireQueue(origin);
        if (!queue) {
            return;
        }
        const index = resolvePosition(position, queue.items.length, false);
        if (queue.items.length === 0 || index < 0 || index >= queue.items.length) {
            this.listener.sendV4Error(origin, Codec_1.ErrorKind.QueuePositionOutOfRange);
            return;
        }
        queue.index = index;
        this.resetItemState();
        this.listener.sendV4(() => (0, Codec_1.encodeQueueItemSelected)(position), { exclude: origin.sessionId });
        this.host.page('setplaylistitem', new Packets_1.SetPlaylistItemMessage(index));
    }
    queueInsert(item, position, origin) {
        const queue = this.requireQueue(origin);
        if (!queue) {
            return;
        }
        if (queue.items.length >= exports.MAX_QUEUE_LENGTH) {
            this.listener.sendV4Error(origin, Codec_1.ErrorKind.QueueFull);
            return;
        }
        const index = resolvePosition(position, queue.items.length, true);
        if (queue.items.length === 0 || index < 0 || index > queue.items.length) {
            this.listener.sendV4Error(origin, Codec_1.ErrorKind.QueuePositionOutOfRange);
            return;
        }
        if (index <= queue.index) {
            queue.index += 1;
        }
        queue.items.splice(index, 0, item);
        this.dropMediaCache();
        this.listener.sendV4(() => (0, Codec_1.encodeQueueInsert)(item, position), { exclude: origin.sessionId });
        this.host.page('queue_update', this.queueUpdate());
    }
    queueRemove(position, origin) {
        const queue = this.requireQueue(origin);
        if (!queue) {
            return;
        }
        const index = resolvePosition(position, queue.items.length, false);
        if (queue.items.length === 0 || index < 0 || index >= queue.items.length) {
            this.listener.sendV4Error(origin, Codec_1.ErrorKind.QueuePositionOutOfRange);
            return;
        }
        if (index === queue.index) {
            this.listener.sendV4Error(origin, Codec_1.ErrorKind.QueueRemovePlayingItem);
            return;
        }
        if (index < queue.index) {
            queue.index -= 1;
        }
        queue.items.splice(index, 1);
        this.dropMediaCache();
        this.listener.sendV4(() => (0, Codec_1.encodeQueueRemove)(position), { exclude: origin.sessionId });
        this.host.page('queue_update', this.queueUpdate());
    }
    // v3 `SetPlaylistItem`.
    setPlaylistItem(index, origin) {
        this.queueSelect({ kind: 'index', index: index }, origin);
    }
    // ---- Transport ------------------------------------------------------------------------------
    pause() {
        this.host.page('pause', null);
    }
    resume() {
        this.host.page('resume', null);
    }
    seek(time, origin) {
        if (!this.loaded) {
            // Like the reference receiver: nothing to seek.
            return;
        }
        const duration = this.playbackUpdate ? this.playbackUpdate.duration : null;
        if (duration !== null && duration !== undefined && isFinite(duration) && duration > 0 && time > duration) {
            if (origin) {
                this.listener.sendV4Error(origin, Codec_1.ErrorKind.SeekOutOfRange);
            }
            time = duration;
        }
        this.host.page('seek', new Packets_1.SeekMessage(Math.max(0, time)));
    }
    setSpeed(speed) {
        const current = this.playbackUpdate && this.playbackUpdate.speed !== null && this.playbackUpdate.speed !== undefined ? this.playbackUpdate.speed : 1;
        if (!this.loaded || Math.abs(current - speed) < 1e-9) {
            // Nothing will change, so the player won't report it: confirm it here, as the
            // reference receiver does.
            this.listener.getV4Sessions().forEach((session) => session.sendV4Speed(speed));
        }
        if (this.loaded) {
            this.host.page('setspeed', new Packets_1.SetSpeedMessage(speed));
        }
    }
    // Confirmed to every sender right away; the player's own report follows.
    setVolume(volume) {
        this.volume = volume;
        this.host.page('setvolume', new Packets_1.SetVolumeMessage(volume));
        this.listener.send(Packets_1.Opcode.VolumeUpdate, new Packets_1.VolumeUpdateMessage(Date.now(), volume));
    }
    // Stops playback. `origin` is the sender that asked (not sent a `StopPlayback` relay), or
    // null when stopped on the TV.
    stop(origin) {
        this.listener.sendV4(() => (0, Codec_1.encodeStopPlayback)(), { exclude: origin ? origin.sessionId : undefined });
        const wasLoaded = this.loaded !== null;
        this.loaded = null;
        this.pendingLoadId = 0;
        this.resetItemState();
        this.dropMediaCache();
        if (wasLoaded) {
            this.listener.getV4Sessions().forEach((session) => session.sendV4PlaybackState(Codec_1.V4PlaybackState.Idle));
            this.listener.send(Packets_1.Opcode.PlaybackUpdate, new Packets_1.PlaybackUpdateMessage(Date.now(), Packets_1.PlaybackState.Idle));
        }
        this.host.page('stop', null);
    }
    // ---- Reports from the player ----------------------------------------------------------------
    onPlaybackUpdate(update) {
        this.playbackUpdate = update;
        this.listener.send(Packets_1.Opcode.PlaybackUpdate, update);
    }
    onVolumeUpdate(update) {
        this.volume = update.volume;
        this.listener.send(Packets_1.Opcode.VolumeUpdate, update);
    }
    // States the v2/v3 update can't express.
    onPlaybackState(state) {
        const v4State = state === 'buffering' ? Codec_1.V4PlaybackState.Buffering : Codec_1.V4PlaybackState.Ended;
        this.listener.getV4Sessions().forEach((session) => session.sendV4PlaybackState(v4State));
    }
    // v2/v3 senders get the player's message. The v4 sender that loaded the media gets an error
    // kind; browsers report a missing resource like one they can't play, so the URL is checked.
    async onPlaybackError(message, kind) {
        this.listener.send(Packets_1.Opcode.PlaybackError, new Packets_1.PlaybackErrorMessage(message));
        const loaded = this.loaded;
        if (!loaded || !loaded.origin) {
            return;
        }
        let errorKind = Codec_1.ErrorKind.ResourceNotFound;
        if (kind !== 'not_found') {
            const item = loaded.queue ? loaded.queue.items[loaded.queue.index] : loaded.message;
            const probe = item && item.url ? await (0, Probe_1.probeUrl)(this.rewrite(item.url), item.headers) : 'unknown';
            if (this.loaded !== loaded) {
                return;
            }
            errorKind = probe === 'missing' ? Codec_1.ErrorKind.ResourceNotFound :
                kind === 'unsupported' || kind === 'decode' ? Codec_1.ErrorKind.UnsupportedFormat : Codec_1.ErrorKind.Internal;
        }
        this.listener.sendV4Error(loaded.origin, errorKind);
    }
    reportLoadError(origin, kind, message) {
        if (origin) {
            this.listener.sendV4Error(origin, kind);
            const session = this.listener.getSession(origin.sessionId);
            if (session && !session.isV4) {
                this.listener.send(Packets_1.Opcode.PlaybackError, new Packets_1.PlaybackErrorMessage(message), origin.sessionId);
            }
        }
    }
    // ---- Tracks and subtitles -----------------------------------------------------------------
    resetItemState() {
        this.playbackUpdate = null;
        this.externals = [];
        if (this.tracks !== null) {
            this.tracks = null;
        }
    }
    trackMessages() {
        const report = this.tracks;
        if (!report) {
            return [];
        }
        return [
            (0, Codec_1.encodeTracksAvailable)(report.tracks),
            (0, Codec_1.encodeChangeTrack)(report.selected.video, 'video'),
            (0, Codec_1.encodeChangeTrack)(report.selected.audio, 'audio'),
            (0, Codec_1.encodeChangeTrack)(report.selected.subtitle, 'subtitle'),
        ];
    }
    // For senders that join mid-playback.
    v4TrackMessages() {
        return this.trackMessages();
    }
    onTracks(loadId, report) {
        if (!this.loaded || this.loaded.loadId !== loadId) {
            return;
        }
        const changed = !sameTracks(this.tracks, report);
        this.tracks = report;
        if (changed) {
            this.listener.sendV4(() => (0, Codec_1.encodeTracksAvailable)(report.tracks));
            this.listener.sendV4(() => (0, Codec_1.encodeChangeTrack)(report.selected.video, 'video'));
            this.listener.sendV4(() => (0, Codec_1.encodeChangeTrack)(report.selected.audio, 'audio'));
            this.listener.sendV4(() => (0, Codec_1.encodeChangeTrack)(report.selected.subtitle, 'subtitle'));
        }
    }
    changeTrack(type, id, origin) {
        if (!this.loaded) {
            this.listener.sendV4Error(origin, Codec_1.ErrorKind.InvalidState);
            return;
        }
        const report = this.tracks;
        if (id !== null && !(report && report.tracks.some((track) => track.id === id && track.type === type))) {
            this.listener.sendV4Error(origin, Codec_1.ErrorKind.MalformedBody);
            return;
        }
        // Subtitles are drawn over the video, so they need it shown.
        if (type === 'subtitle' && id !== null && report && report.selected.video === null && report.tracks.some((track) => track.type === 'video')) {
            this.listener.sendV4Error(origin, Codec_1.ErrorKind.InvalidState);
            return;
        }
        this.host.page('changetrack', { loadId: this.loaded.loadId, type: type, id: id });
    }
    addSubtitle(sourceUrl, select, name, origin) {
        const loaded = this.loaded;
        const report = this.tracks;
        if (!loaded || loaded.mirroring || loaded.viewer !== 'player' || (report && (report.live || !report.seekable))) {
            this.listener.sendV4Error(origin, Codec_1.ErrorKind.InvalidState);
            return;
        }
        const subtitle = { id: this.nextExternalId++, url: sourceUrl, name: name, origin: origin };
        this.externals.push(subtitle);
        this.host.page('addsubtitle', {
            loadId: loaded.loadId,
            id: subtitle.id,
            url: this.host.subtitleUrl(this.rewrite(sourceUrl)),
            name: name,
            select: select,
        });
    }
    // The player could not load an external subtitle.
    onSubtitleFailed(id) {
        const index = this.externals.findIndex((subtitle) => subtitle.id === id);
        if (index < 0) {
            return;
        }
        const [subtitle] = this.externals.splice(index, 1);
        logger.warn(`External subtitle ${subtitle.url} failed to load`);
        if (subtitle.origin) {
            this.listener.sendV4Error(subtitle.origin, Codec_1.ErrorKind.ResourceNotFound);
        }
    }
    // ---- Mirroring (v4 StartMirroringSession) -----------------------------------------------
    startMirroring(origin, supported) {
        if (!supported) {
            this.listener.sendV4Error(origin, Codec_1.ErrorKind.UnsupportedFormat);
            return;
        }
        const loadId = this.nextLoadId++;
        this.pendingLoadId = loadId;
        this.resetItemState();
        this.dropMediaCache();
        // Players need a URL; a unique one also keeps a new session from looking like the last.
        const message = new Packets_1.PlayMessage(exports.MIRRORING_CONTAINER, `fwebrtc://mirroring/${loadId}`);
        this.loaded = {
            loadId: loadId,
            origin: origin,
            message: message,
            queue: null,
            mirroring: { sessionId: origin.sessionId, offer: null },
            singlePlayInfo: {
                loadId: loadId,
                rendererEvent: 'play',
                rendererMessage: message,
                proxyUrl: null,
                contentViewer: 'player',
                playerVolume: this.volume,
            },
            viewer: 'player',
        };
        this.host.page('load', this.playInfo());
        this.host.ensurePage();
    }
    mirroringOffer(sdp, origin) {
        const loaded = this.loaded;
        if (!loaded || !loaded.mirroring || loaded.mirroring.sessionId !== origin.sessionId) {
            this.listener.sendV4Error(origin, Codec_1.ErrorKind.InvalidState);
            return;
        }
        loaded.mirroring.offer = sdp;
        this.host.page('mirroring_offer', { loadId: loaded.loadId, sdp: sdp });
    }
    mirroringAnswer(loadId, sdp) {
        const loaded = this.loaded;
        if (!loaded || loaded.loadId !== loadId || !loaded.mirroring) {
            return;
        }
        const session = this.listener.getSession(loaded.mirroring.sessionId);
        if (!session || !session.sendMirroringAnswer(sdp)) {
            logger.warn('The mirroring sender is gone; dropping the answer');
        }
    }
    // A sender disconnected: mirroring from it can't continue.
    onSenderGone(sessionId) {
        if (this.loaded && this.loaded.mirroring && this.loaded.mirroring.sessionId === sessionId) {
            logger.info('The mirroring sender disconnected; stopping');
            this.stop(null);
        }
    }
}
exports.MediaSession = MediaSession;


/***/ }),

/***/ 7699:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.SpeedChanged = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class SpeedChanged {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsSpeedChanged(bb, obj) {
        return (obj || new SpeedChanged()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsSpeedChanged(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new SpeedChanged()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    speed() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readFloat32(this.bb_pos + offset) : 0.0;
    }
    static startSpeedChanged(builder) {
        builder.startObject(1);
    }
    static addSpeed(builder, speed) {
        builder.addFieldFloat32(0, speed, 0.0);
    }
    static endSpeedChanged(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createSpeedChanged(builder, speed) {
        SpeedChanged.startSpeedChanged(builder);
        SpeedChanged.addSpeed(builder, speed);
        return SpeedChanged.endSpeedChanged(builder);
    }
}
exports.SpeedChanged = SpeedChanged;


/***/ }),

/***/ 7825:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.QueueMarkerBack = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class QueueMarkerBack {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsQueueMarkerBack(bb, obj) {
        return (obj || new QueueMarkerBack()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsQueueMarkerBack(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new QueueMarkerBack()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static startQueueMarkerBack(builder) {
        builder.startObject(0);
    }
    static endQueueMarkerBack(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createQueueMarkerBack(builder) {
        QueueMarkerBack.startQueueMarkerBack(builder);
        return QueueMarkerBack.endQueueMarkerBack(builder);
    }
}
exports.QueueMarkerBack = QueueMarkerBack;


/***/ }),

/***/ 7829:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.Packet = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const message_1 = __webpack_require__(2053);
class Packet {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsPacket(bb, obj) {
        return (obj || new Packet()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsPacket(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new Packet()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    payloadType() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readUint8(this.bb_pos + offset) : message_1.Message.NONE;
    }
    payload(obj) {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.__union(obj, this.bb_pos + offset) : null;
    }
    static startPacket(builder) {
        builder.startObject(2);
    }
    static addPayloadType(builder, payloadType) {
        builder.addFieldInt8(0, payloadType, message_1.Message.NONE);
    }
    static addPayload(builder, payloadOffset) {
        builder.addFieldOffset(1, payloadOffset, 0);
    }
    static endPacket(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static finishPacketBuffer(builder, offset) {
        builder.finish(offset);
    }
    static finishSizePrefixedPacketBuffer(builder, offset) {
        builder.finish(offset, undefined, true);
    }
    static createPacket(builder, payloadType, payloadOffset) {
        Packet.startPacket(builder);
        Packet.addPayloadType(builder, payloadType);
        Packet.addPayload(builder, payloadOffset);
        return Packet.endPacket(builder);
    }
}
exports.Packet = Packet;


/***/ }),

/***/ 8168:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.CompanionHelloResponse = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class CompanionHelloResponse {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsCompanionHelloResponse(bb, obj) {
        return (obj || new CompanionHelloResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsCompanionHelloResponse(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new CompanionHelloResponse()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    providerId() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readUint16(this.bb_pos + offset) : 0;
    }
    static startCompanionHelloResponse(builder) {
        builder.startObject(1);
    }
    static addProviderId(builder, providerId) {
        builder.addFieldInt16(0, providerId, 0);
    }
    static endCompanionHelloResponse(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createCompanionHelloResponse(builder, providerId) {
        CompanionHelloResponse.startCompanionHelloResponse(builder);
        CompanionHelloResponse.addProviderId(builder, providerId);
        return CompanionHelloResponse.endCompanionHelloResponse(builder);
    }
}
exports.CompanionHelloResponse = CompanionHelloResponse;


/***/ }),

/***/ 8169:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MODULE_NAME = exports.MODULE_TYPE = void 0;
exports.isTizen = isTizen;
exports.dataDirectory = dataDirectory;
exports.dataPath = dataPath;
exports.fetchDeviceName = fetchDeviceName;
exports.launchModule = launchModule;
/* eslint-disable @typescript-eslint/no-explicit-any -- the TizenBrew sandbox's `tizen` global is untyped */
const fs = __importStar(__webpack_require__(9896));
const http = __importStar(__webpack_require__(8611));
const os = __importStar(__webpack_require__(857));
const path = __importStar(__webpack_require__(6928));
const Logger_1 = __webpack_require__(1943);
const logger = new Logger_1.Logger('Platform', Logger_1.LoggerType.BACKEND);
exports.MODULE_TYPE = "gh/BlindeCode/tizenbrew-brewcast".substring(0, "gh/BlindeCode/tizenbrew-brewcast".indexOf('/'));
exports.MODULE_NAME = "gh/BlindeCode/tizenbrew-brewcast".substring("gh/BlindeCode/tizenbrew-brewcast".indexOf('/') + 1);
function tizenApi() {
    return typeof tizen !== 'undefined' ? tizen : null;
}
function isTizen() {
    return tizenApi() !== null;
}
// Where state such as the v4 key is kept: TizenBrew's own writable directory on the TV, or
// BREWCAST_DATA_DIR elsewhere. Null means nothing is persisted.
function dataDirectory() {
    const candidates = [process.env.BREWCAST_DATA_DIR, '/home/owner/share'];
    for (const dir of candidates) {
        if (dir && fs.existsSync(dir)) {
            return dir;
        }
    }
    return null;
}
function dataPath(file) {
    const dir = dataDirectory();
    return dir !== null ? path.join(dir, file) : null;
}
// Receiver name shown in sender apps: the TV's own name from Samsung's local REST API when
// available ("[TV] Samsung Q80 Series (55)" style), else manufacturer and model, else hostname.
function fetchDeviceName() {
    const fallback = () => {
        const api = tizenApi();
        if (api) {
            try {
                const manufacturer = api.systeminfo.getCapability('http://tizen.org/system/manufacturer');
                const model = api.systeminfo.getCapability('http://tizen.org/system/model_name');
                return `${manufacturer} ${model}`;
            }
            catch (e) {
                logger.warn('Could not read the TV model', e);
            }
        }
        return `BrewCast ${os.hostname()}`;
    };
    if (!isTizen()) {
        return Promise.resolve(fallback());
    }
    return new Promise((resolve) => {
        const req = http.get({ host: '127.0.0.1', port: 8001, path: '/api/v2/', timeout: 2000 }, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => { body += chunk; });
            res.on('end', () => {
                try {
                    const name = JSON.parse(body).device.name;
                    resolve(typeof name === 'string' && name.length > 0 ? name : fallback());
                }
                catch (_a) {
                    resolve(fallback());
                }
            });
        });
        req.on('timeout', () => req.destroy());
        req.on('error', () => resolve(fallback()));
    });
}
// Asks TizenBrew to open this module, used when a sender starts playback while no page of ours
// is open. TizenBrew reads `{ moduleName, moduleType, args }` from the first AppControl data
// entry and navigates to the module's page with `args` as the query string.
function launchModule(args) {
    const api = tizenApi();
    if (!api) {
        logger.info(`Not on Tizen; would launch the module with ${args}`);
        return;
    }
    try {
        const appId = `${api.application.getAppInfo().packageId}.TizenBrewStandalone`;
        const data = [new api.ApplicationControlData('module', [JSON.stringify({ moduleName: exports.MODULE_NAME, moduleType: exports.MODULE_TYPE, args: args })])];
        const control = new api.ApplicationControl('http://tizen.org/appcontrol/operation/default', null, null, null, data);
        api.application.launchAppControl(control, appId, () => logger.info('Asked TizenBrew to open the module'), (error) => logger.error(`Could not open the module: ${error && error.message}`));
    }
    catch (e) {
        logger.error('Could not open the module', e);
    }
}


/***/ }),

/***/ 8198:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.fsSynchronousApiList = void 0;
exports.fsSynchronousApiList = [
    'accessSync',
    'appendFileSync',
    'chmodSync',
    'chownSync',
    'closeSync',
    'copyFileSync',
    'existsSync',
    'fchmodSync',
    'fchownSync',
    'fdatasyncSync',
    'fstatSync',
    'fsyncSync',
    'ftruncateSync',
    'futimesSync',
    'lchmodSync',
    'lchownSync',
    'linkSync',
    'lstatSync',
    'mkdirSync',
    'mkdtempSync',
    'openSync',
    'readdirSync',
    'readFileSync',
    'readlinkSync',
    'readSync',
    'readvSync',
    'realpathSync',
    'renameSync',
    'rmdirSync',
    'rmSync',
    'statSync',
    'symlinkSync',
    'truncateSync',
    'unlinkSync',
    'utimesSync',
    'lutimesSync',
    'writeFileSync',
    'writeSync',
    'writevSync',
    // 'cpSync',
    // 'statfsSync',
];


/***/ }),

/***/ 8317:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GenericMetaList = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const wrapped_generic_meta_value_1 = __webpack_require__(9028);
class GenericMetaList {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsGenericMetaList(bb, obj) {
        return (obj || new GenericMetaList()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsGenericMetaList(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new GenericMetaList()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    value(index, obj) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? (obj || new wrapped_generic_meta_value_1.WrappedGenericMetaValue()).__init(this.bb.__indirect(this.bb.__vector(this.bb_pos + offset) + index * 4), this.bb) : null;
    }
    valueLength() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.__vector_len(this.bb_pos + offset) : 0;
    }
    static startGenericMetaList(builder) {
        builder.startObject(1);
    }
    static addValue(builder, valueOffset) {
        builder.addFieldOffset(0, valueOffset, 0);
    }
    static createValueVector(builder, data) {
        builder.startVector(4, data.length, 4);
        for (let i = data.length - 1; i >= 0; i--) {
            builder.addOffset(data[i]);
        }
        return builder.endVector();
    }
    static startValueVector(builder, numElems) {
        builder.startVector(4, numElems, 4);
    }
    static endGenericMetaList(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createGenericMetaList(builder, valueOffset) {
        GenericMetaList.startGenericMetaList(builder);
        GenericMetaList.addValue(builder, valueOffset);
        return GenericMetaList.endGenericMetaList(builder);
    }
}
exports.GenericMetaList = GenericMetaList;


/***/ }),

/***/ 8335:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MediaTrack = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const media_track_metadata_1 = __webpack_require__(1973);
class MediaTrack {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsMediaTrack(bb, obj) {
        return (obj || new MediaTrack()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsMediaTrack(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new MediaTrack()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    id() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readUint32(this.bb_pos + offset) : 0;
    }
    iso639(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    title(optionalEncoding) {
        const offset = this.bb.__offset(this.bb_pos, 8);
        return offset ? this.bb.__string(this.bb_pos + offset, optionalEncoding) : null;
    }
    metadataType() {
        const offset = this.bb.__offset(this.bb_pos, 10);
        return offset ? this.bb.readUint8(this.bb_pos + offset) : media_track_metadata_1.MediaTrackMetadata.NONE;
    }
    metadata(obj) {
        const offset = this.bb.__offset(this.bb_pos, 12);
        return offset ? this.bb.__union(obj, this.bb_pos + offset) : null;
    }
    static startMediaTrack(builder) {
        builder.startObject(5);
    }
    static addId(builder, id) {
        builder.addFieldInt32(0, id, 0);
    }
    static addIso639(builder, iso639Offset) {
        builder.addFieldOffset(1, iso639Offset, 0);
    }
    static addTitle(builder, titleOffset) {
        builder.addFieldOffset(2, titleOffset, 0);
    }
    static addMetadataType(builder, metadataType) {
        builder.addFieldInt8(3, metadataType, media_track_metadata_1.MediaTrackMetadata.NONE);
    }
    static addMetadata(builder, metadataOffset) {
        builder.addFieldOffset(4, metadataOffset, 0);
    }
    static endMediaTrack(builder) {
        const offset = builder.endObject();
        builder.requiredField(offset, 6); // iso_639
        return offset;
    }
    static createMediaTrack(builder, id, iso639Offset, titleOffset, metadataType, metadataOffset) {
        MediaTrack.startMediaTrack(builder);
        MediaTrack.addId(builder, id);
        MediaTrack.addIso639(builder, iso639Offset);
        MediaTrack.addTitle(builder, titleOffset);
        MediaTrack.addMetadataType(builder, metadataType);
        MediaTrack.addMetadata(builder, metadataOffset);
        return MediaTrack.endMediaTrack(builder);
    }
}
exports.MediaTrack = MediaTrack;


/***/ }),

/***/ 8460:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.ListenerService = void 0;
const Packets_1 = __webpack_require__(834);
const Logger_1 = __webpack_require__(1943);
const UtilityBackend_1 = __webpack_require__(8819);
const events_1 = __webpack_require__(4434);
const Main_1 = __webpack_require__(1759);
const logger = new Logger_1.Logger('ListenerService', Logger_1.LoggerType.BACKEND);
class ListenerService {
    constructor() {
        this.emitter = new events_1.EventEmitter();
        this.sessionMap = new Map();
        this.eventSubscribers = new Map();
    }
    send(opcode, message = null, sessionId = null) {
        // logger.info(`Sending message ${JSON.stringify(message)}`);
        var _a, _b;
        if (sessionId) {
            if (opcode === Packets_1.Opcode.Event.valueOf() && !this.isSubscribedToEvent(sessionId, message.event)) {
                return;
            }
            try {
                (_a = this.sessionMap.get(sessionId)) === null || _a === void 0 ? void 0 : _a.send(opcode, message);
            }
            catch (e) {
                logger.warn("Failed to send error.", e);
                (_b = this.sessionMap.get(sessionId)) === null || _b === void 0 ? void 0 : _b.close();
            }
        }
        else {
            for (const session of this.sessionMap.values()) {
                if (opcode === Packets_1.Opcode.Event.valueOf() && !this.isSubscribedToEvent(session.sessionId, message.event)) {
                    continue;
                }
                try {
                    session.send(opcode, message);
                }
                catch (e) {
                    logger.warn("Failed to send error.", e);
                    session.close();
                }
            }
        }
    }
    // Sends a v4 message to v4 sessions: all of them, only one (`only`), or all but the one that
    // made the request being relayed (`exclude`). The message is only built when a session will
    // get it: runtimes without v4 can't encode v4 messages (no TextEncoder or BigInt).
    sendV4(message, options = {}) {
        const targets = [...this.sessionMap.values()].filter((session) => session.isV4 &&
            (options.only === undefined || session.sessionId === options.only) &&
            (options.exclude === undefined || session.sessionId !== options.exclude));
        if (targets.length === 0) {
            return;
        }
        const data = message();
        for (const session of targets) {
            try {
                session.sendV4Message(data);
            }
            catch (e) {
                logger.warn("Failed to send.", e);
                session.close();
            }
        }
    }
    // Answers a v4 request with an `Error` (no-op for v2/v3 senders, which have no equivalent).
    sendV4Error(origin, kind) {
        var _a;
        (_a = this.sessionMap.get(origin.sessionId)) === null || _a === void 0 ? void 0 : _a.sendV4Error(kind, origin.packetNumber);
    }
    getSession(sessionId) {
        return this.sessionMap.get(sessionId);
    }
    getV4Sessions() {
        return [...this.sessionMap.values()].filter((session) => session.isV4);
    }
    subscribeEvent(sessionId, event) {
        if (!this.eventSubscribers.has(sessionId)) {
            this.eventSubscribers.set(sessionId, []);
        }
        let sessionSubscriptions = this.eventSubscribers.get(sessionId);
        sessionSubscriptions.push(event);
        this.eventSubscribers.set(sessionId, sessionSubscriptions);
    }
    unsubscribeEvent(sessionId, event) {
        if (this.eventSubscribers.has(sessionId)) {
            let sessionSubscriptions = this.eventSubscribers.get(sessionId);
            const index = sessionSubscriptions.findIndex((obj) => (0, UtilityBackend_1.deepEqual)(obj, event));
            if (index != -1) {
                sessionSubscriptions.splice(index, 1);
            }
            this.eventSubscribers.set(sessionId, sessionSubscriptions);
        }
    }
    getSessions() {
        return [...this.sessionMap.keys()];
    }
    getSessionProtocolVersion(sessionId) {
        var _a;
        return (_a = this.sessionMap.get(sessionId)) === null || _a === void 0 ? void 0 : _a.protocolVersion;
    }
    getAllSubscribedKeys() {
        let keyDown = new Set();
        let keyUp = new Set();
        for (const session of this.eventSubscribers.values()) {
            for (const event of session) {
                switch (event.type) {
                    case Packets_1.EventType.KeyDown:
                        keyDown = new Set([...keyDown, ...event.keys]);
                        break;
                    case Packets_1.EventType.KeyUp:
                        keyUp = new Set([...keyUp, ...event.keys]);
                        break;
                    default:
                        break;
                }
            }
        }
        return { keyDown: keyDown, keyUp: keyUp };
    }
    isSubscribedToEvent(sessionId, event) {
        let isSubscribed = false;
        if (this.eventSubscribers.has(sessionId)) {
            // Not `.values()`: arrays only have it since Node 10.9.
            for (const e of this.eventSubscribers.get(sessionId)) {
                if (e.type === event.type) {
                    if (e.type === Packets_1.EventType.KeyDown.valueOf() || e.type === Packets_1.EventType.KeyUp.valueOf()) {
                        const subscribeEvent = e.type === Packets_1.EventType.KeyDown.valueOf() ? e : e;
                        const keyEvent = event;
                        if (!subscribeEvent.keys.includes(keyEvent.key)) {
                            continue;
                        }
                    }
                    isSubscribed = true;
                    break;
                }
            }
        }
        return isSubscribed;
    }
    async handleServerError(err) {
        (0, Main_1.errorHandler)(err);
    }
}
exports.ListenerService = ListenerService;


/***/ }),

/***/ 8535:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.QueueIndex = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class QueueIndex {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsQueueIndex(bb, obj) {
        return (obj || new QueueIndex()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsQueueIndex(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new QueueIndex()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    index() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readUint8(this.bb_pos + offset) : 0;
    }
    static startQueueIndex(builder) {
        builder.startObject(1);
    }
    static addIndex(builder, index) {
        builder.addFieldInt8(0, index, 0);
    }
    static endQueueIndex(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createQueueIndex(builder, index) {
        QueueIndex.startQueueIndex(builder);
        QueueIndex.addIndex(builder, index);
        return QueueIndex.endQueueIndex(builder);
    }
}
exports.QueueIndex = QueueIndex;


/***/ }),

/***/ 8581:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.File = exports.Link = exports.Node = exports.SEP = void 0;
const process_1 = __webpack_require__(5976);
const buffer_1 = __webpack_require__(9897);
const constants_1 = __webpack_require__(2612);
const events_1 = __webpack_require__(4434);
const Stats_1 = __webpack_require__(4054);
const { S_IFMT, S_IFDIR, S_IFREG, S_IFLNK, S_IFCHR, O_APPEND } = constants_1.constants;
const getuid = () => { var _a, _b; return (_b = (_a = process_1.default.getuid) === null || _a === void 0 ? void 0 : _a.call(process_1.default)) !== null && _b !== void 0 ? _b : 0; };
const getgid = () => { var _a, _b; return (_b = (_a = process_1.default.getgid) === null || _a === void 0 ? void 0 : _a.call(process_1.default)) !== null && _b !== void 0 ? _b : 0; };
exports.SEP = '/';
/**
 * Node in a file system (like i-node, v-node).
 */
class Node extends events_1.EventEmitter {
    constructor(ino, mode = 0o666) {
        super();
        // User ID and group ID.
        this._uid = getuid();
        this._gid = getgid();
        this._atime = new Date();
        this._mtime = new Date();
        this._ctime = new Date();
        this.rdev = 0;
        // Number of hard links pointing at this Node.
        this._nlink = 1;
        this.mode = mode;
        this.ino = ino;
    }
    set ctime(ctime) {
        this._ctime = ctime;
    }
    get ctime() {
        return this._ctime;
    }
    set uid(uid) {
        this._uid = uid;
        this.ctime = new Date();
    }
    get uid() {
        return this._uid;
    }
    set gid(gid) {
        this._gid = gid;
        this.ctime = new Date();
    }
    get gid() {
        return this._gid;
    }
    set atime(atime) {
        this._atime = atime;
        this.ctime = new Date();
    }
    get atime() {
        return this._atime;
    }
    set mtime(mtime) {
        this._mtime = mtime;
        this.ctime = new Date();
    }
    get mtime() {
        return this._mtime;
    }
    get perm() {
        return this.mode & ~S_IFMT;
    }
    set perm(perm) {
        this.mode = (this.mode & S_IFMT) | (perm & ~S_IFMT);
        this.ctime = new Date();
    }
    set nlink(nlink) {
        this._nlink = nlink;
        this.ctime = new Date();
    }
    get nlink() {
        return this._nlink;
    }
    getString(encoding = 'utf8') {
        this.atime = new Date();
        return this.getBuffer().toString(encoding);
    }
    setString(str) {
        // this.setBuffer(bufferFrom(str, 'utf8'));
        this.buf = (0, buffer_1.bufferFrom)(str, 'utf8');
        this.touch();
    }
    getBuffer() {
        this.atime = new Date();
        if (!this.buf)
            this.setBuffer((0, buffer_1.bufferAllocUnsafe)(0));
        return (0, buffer_1.bufferFrom)(this.buf); // Return a copy.
    }
    setBuffer(buf) {
        this.buf = (0, buffer_1.bufferFrom)(buf); // Creates a copy of data.
        this.touch();
    }
    getSize() {
        return this.buf ? this.buf.length : 0;
    }
    setModeProperty(property) {
        this.mode = property;
    }
    isFile() {
        return (this.mode & S_IFMT) === S_IFREG;
    }
    isDirectory() {
        return (this.mode & S_IFMT) === S_IFDIR;
    }
    isSymlink() {
        // return !!this.symlink;
        return (this.mode & S_IFMT) === S_IFLNK;
    }
    isCharacterDevice() {
        return (this.mode & S_IFMT) === S_IFCHR;
    }
    makeSymlink(symlink) {
        this.mode = S_IFLNK | 0o666;
        this.symlink = symlink;
    }
    write(buf, off = 0, len = buf.length, pos = 0) {
        if (!this.buf)
            this.buf = (0, buffer_1.bufferAllocUnsafe)(0);
        if (pos + len > this.buf.length) {
            const newBuf = (0, buffer_1.bufferAllocUnsafe)(pos + len);
            this.buf.copy(newBuf, 0, 0, this.buf.length);
            this.buf = newBuf;
        }
        buf.copy(this.buf, pos, off, off + len);
        this.touch();
        return len;
    }
    // Returns the number of bytes read.
    read(buf, off = 0, len = buf.byteLength, pos = 0) {
        this.atime = new Date();
        if (!this.buf)
            this.buf = (0, buffer_1.bufferAllocUnsafe)(0);
        let actualLen = len;
        if (actualLen > buf.byteLength) {
            actualLen = buf.byteLength;
        }
        if (actualLen + pos > this.buf.length) {
            actualLen = this.buf.length - pos;
        }
        const buf2 = buf instanceof buffer_1.Buffer ? buf : buffer_1.Buffer.from(buf.buffer);
        this.buf.copy(buf2, off, pos, pos + actualLen);
        return actualLen;
    }
    truncate(len = 0) {
        if (!len)
            this.buf = (0, buffer_1.bufferAllocUnsafe)(0);
        else {
            if (!this.buf)
                this.buf = (0, buffer_1.bufferAllocUnsafe)(0);
            if (len <= this.buf.length) {
                this.buf = this.buf.slice(0, len);
            }
            else {
                const buf = (0, buffer_1.bufferAllocUnsafe)(len);
                this.buf.copy(buf);
                buf.fill(0, this.buf.length);
                this.buf = buf;
            }
        }
        this.touch();
    }
    chmod(perm) {
        this.mode = (this.mode & S_IFMT) | (perm & ~S_IFMT);
        this.touch();
    }
    chown(uid, gid) {
        this.uid = uid;
        this.gid = gid;
        this.touch();
    }
    touch() {
        this.mtime = new Date();
        this.emit('change', this);
    }
    canRead(uid = getuid(), gid = getgid()) {
        if (this.perm & 4 /* S.IROTH */) {
            return true;
        }
        if (gid === this.gid) {
            if (this.perm & 32 /* S.IRGRP */) {
                return true;
            }
        }
        if (uid === this.uid) {
            if (this.perm & 256 /* S.IRUSR */) {
                return true;
            }
        }
        return false;
    }
    canWrite(uid = getuid(), gid = getgid()) {
        if (this.perm & 2 /* S.IWOTH */) {
            return true;
        }
        if (gid === this.gid) {
            if (this.perm & 16 /* S.IWGRP */) {
                return true;
            }
        }
        if (uid === this.uid) {
            if (this.perm & 128 /* S.IWUSR */) {
                return true;
            }
        }
        return false;
    }
    canExecute(uid = getuid(), gid = getgid()) {
        if (this.perm & 1 /* S.IXOTH */) {
            return true;
        }
        if (gid === this.gid) {
            if (this.perm & 8 /* S.IXGRP */) {
                return true;
            }
        }
        if (uid === this.uid) {
            if (this.perm & 64 /* S.IXUSR */) {
                return true;
            }
        }
        return false;
    }
    del() {
        this.emit('delete', this);
    }
    toJSON() {
        return {
            ino: this.ino,
            uid: this.uid,
            gid: this.gid,
            atime: this.atime.getTime(),
            mtime: this.mtime.getTime(),
            ctime: this.ctime.getTime(),
            perm: this.perm,
            mode: this.mode,
            nlink: this.nlink,
            symlink: this.symlink,
            data: this.getString(),
        };
    }
}
exports.Node = Node;
/**
 * Represents a hard link that points to an i-node `node`.
 */
class Link extends events_1.EventEmitter {
    get steps() {
        return this._steps;
    }
    // Recursively sync children steps, e.g. in case of dir rename
    set steps(val) {
        this._steps = val;
        for (const [child, link] of this.children.entries()) {
            if (child === '.' || child === '..') {
                continue;
            }
            link === null || link === void 0 ? void 0 : link.syncSteps();
        }
    }
    constructor(vol, parent, name) {
        super();
        this.children = new Map();
        // Path to this node as Array: ['usr', 'bin', 'node'].
        this._steps = [];
        // "i-node" number of the node.
        this.ino = 0;
        // Number of children.
        this.length = 0;
        this.vol = vol;
        this.parent = parent;
        this.name = name;
        this.syncSteps();
    }
    setNode(node) {
        this.node = node;
        this.ino = node.ino;
    }
    getNode() {
        return this.node;
    }
    createChild(name, node = this.vol.createNode(S_IFREG | 0o666)) {
        const link = new Link(this.vol, this, name);
        link.setNode(node);
        if (node.isDirectory()) {
            link.children.set('.', link);
            link.getNode().nlink++;
        }
        this.setChild(name, link);
        return link;
    }
    setChild(name, link = new Link(this.vol, this, name)) {
        this.children.set(name, link);
        link.parent = this;
        this.length++;
        const node = link.getNode();
        if (node.isDirectory()) {
            link.children.set('..', this);
            this.getNode().nlink++;
        }
        this.getNode().mtime = new Date();
        this.emit('child:add', link, this);
        return link;
    }
    deleteChild(link) {
        const node = link.getNode();
        if (node.isDirectory()) {
            link.children.delete('..');
            this.getNode().nlink--;
        }
        this.children.delete(link.getName());
        this.length--;
        this.getNode().mtime = new Date();
        this.emit('child:delete', link, this);
    }
    getChild(name) {
        this.getNode().mtime = new Date();
        return this.children.get(name);
    }
    getPath() {
        return this.steps.join(exports.SEP);
    }
    getParentPath() {
        return this.steps.slice(0, -1).join(exports.SEP);
    }
    getName() {
        return this.steps[this.steps.length - 1];
    }
    // del() {
    //     const parent = this.parent;
    //     if(parent) {
    //         parent.deleteChild(link);
    //     }
    //     this.parent = null;
    //     this.vol = null;
    // }
    toJSON() {
        return {
            steps: this.steps,
            ino: this.ino,
            children: Array.from(this.children.keys()),
        };
    }
    syncSteps() {
        this.steps = this.parent ? this.parent.steps.concat([this.name]) : [this.name];
    }
}
exports.Link = Link;
/**
 * Represents an open file (file descriptor) that points to a `Link` (Hard-link) and a `Node`.
 */
class File {
    /**
     * Open a Link-Node pair. `node` is provided separately as that might be a different node
     * rather the one `link` points to, because it might be a symlink.
     * @param link
     * @param node
     * @param flags
     * @param fd
     */
    constructor(link, node, flags, fd) {
        this.link = link;
        this.node = node;
        this.flags = flags;
        this.fd = fd;
        this.position = 0;
        if (this.flags & O_APPEND)
            this.position = this.getSize();
    }
    getString(encoding = 'utf8') {
        return this.node.getString();
    }
    setString(str) {
        this.node.setString(str);
    }
    getBuffer() {
        return this.node.getBuffer();
    }
    setBuffer(buf) {
        this.node.setBuffer(buf);
    }
    getSize() {
        return this.node.getSize();
    }
    truncate(len) {
        this.node.truncate(len);
    }
    seekTo(position) {
        this.position = position;
    }
    stats() {
        return Stats_1.default.build(this.node);
    }
    write(buf, offset = 0, length = buf.length, position) {
        if (typeof position !== 'number')
            position = this.position;
        const bytes = this.node.write(buf, offset, length, position);
        this.position = position + bytes;
        return bytes;
    }
    read(buf, offset = 0, length = buf.byteLength, position) {
        if (typeof position !== 'number')
            position = this.position;
        const bytes = this.node.read(buf, offset, length, position);
        this.position = position + bytes;
        return bytes;
    }
    chmod(perm) {
        this.node.chmod(perm);
    }
    chown(uid, gid) {
        this.node.chown(uid, gid);
    }
}
exports.File = File;


/***/ }),

/***/ 8611:
/***/ ((module) => {

"use strict";
module.exports = require("http");

/***/ }),

/***/ 8620:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FileHandle = void 0;
const util_1 = __webpack_require__(4784);
class FileHandle {
    constructor(fs, fd) {
        this.fs = fs;
        this.fd = fd;
    }
    appendFile(data, options) {
        return (0, util_1.promisify)(this.fs, 'appendFile')(this.fd, data, options);
    }
    chmod(mode) {
        return (0, util_1.promisify)(this.fs, 'fchmod')(this.fd, mode);
    }
    chown(uid, gid) {
        return (0, util_1.promisify)(this.fs, 'fchown')(this.fd, uid, gid);
    }
    close() {
        return (0, util_1.promisify)(this.fs, 'close')(this.fd);
    }
    datasync() {
        return (0, util_1.promisify)(this.fs, 'fdatasync')(this.fd);
    }
    createReadStream(options) {
        return this.fs.createReadStream('', Object.assign(Object.assign({}, options), { fd: this }));
    }
    createWriteStream(options) {
        return this.fs.createWriteStream('', Object.assign(Object.assign({}, options), { fd: this }));
    }
    readableWebStream(options) {
        return new ReadableStream({
            pull: async (controller) => {
                const data = await this.readFile();
                controller.enqueue(data);
                controller.close();
            },
        });
    }
    read(buffer, offset, length, position) {
        return (0, util_1.promisify)(this.fs, 'read', bytesRead => ({ bytesRead, buffer }))(this.fd, buffer, offset, length, position);
    }
    readv(buffers, position) {
        return (0, util_1.promisify)(this.fs, 'readv', bytesRead => ({ bytesRead, buffers }))(this.fd, buffers, position);
    }
    readFile(options) {
        return (0, util_1.promisify)(this.fs, 'readFile')(this.fd, options);
    }
    stat(options) {
        return (0, util_1.promisify)(this.fs, 'fstat')(this.fd, options);
    }
    sync() {
        return (0, util_1.promisify)(this.fs, 'fsync')(this.fd);
    }
    truncate(len) {
        return (0, util_1.promisify)(this.fs, 'ftruncate')(this.fd, len);
    }
    utimes(atime, mtime) {
        return (0, util_1.promisify)(this.fs, 'futimes')(this.fd, atime, mtime);
    }
    write(buffer, offset, length, position) {
        return (0, util_1.promisify)(this.fs, 'write', bytesWritten => ({ bytesWritten, buffer }))(this.fd, buffer, offset, length, position);
    }
    writev(buffers, position) {
        return (0, util_1.promisify)(this.fs, 'writev', bytesWritten => ({ bytesWritten, buffers }))(this.fd, buffers, position);
    }
    writeFile(data, options) {
        return (0, util_1.promisify)(this.fs, 'writeFile')(this.fd, data, options);
    }
}
exports.FileHandle = FileHandle;


/***/ }),

/***/ 8706:
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

"use strict";
// ESM COMPAT FLAG
__webpack_require__.r(__webpack_exports__);

// EXPORTS
__webpack_require__.d(__webpack_exports__, {
  Builder: () => (/* reexport */ Builder),
  ByteBuffer: () => (/* reexport */ ByteBuffer),
  Encoding: () => (/* reexport */ Encoding),
  FILE_IDENTIFIER_LENGTH: () => (/* reexport */ FILE_IDENTIFIER_LENGTH),
  SIZEOF_INT: () => (/* reexport */ SIZEOF_INT),
  SIZEOF_SHORT: () => (/* reexport */ SIZEOF_SHORT),
  SIZE_PREFIX_LENGTH: () => (/* reexport */ SIZE_PREFIX_LENGTH),
  float32: () => (/* reexport */ float32),
  float64: () => (/* reexport */ float64),
  int32: () => (/* reexport */ int32),
  isLittleEndian: () => (/* reexport */ isLittleEndian)
});

;// ./node_modules/flatbuffers/mjs/constants.js
const SIZEOF_SHORT = 2;
const SIZEOF_INT = 4;
const FILE_IDENTIFIER_LENGTH = 4;
const SIZE_PREFIX_LENGTH = 4;

;// ./node_modules/flatbuffers/mjs/utils.js
const int32 = new Int32Array(2);
const float32 = new Float32Array(int32.buffer);
const float64 = new Float64Array(int32.buffer);
const isLittleEndian = new Uint16Array(new Uint8Array([1, 0]).buffer)[0] === 1;

;// ./node_modules/flatbuffers/mjs/encoding.js
var Encoding;
(function (Encoding) {
    Encoding[Encoding["UTF8_BYTES"] = 1] = "UTF8_BYTES";
    Encoding[Encoding["UTF16_STRING"] = 2] = "UTF16_STRING";
})(Encoding || (Encoding = {}));

;// ./node_modules/flatbuffers/mjs/byte-buffer.js



class ByteBuffer {
    /**
     * Create a new ByteBuffer with a given array of bytes (`Uint8Array`)
     */
    constructor(bytes_) {
        this.bytes_ = bytes_;
        this.position_ = 0;
        this.text_decoder_ = new TextDecoder();
    }
    /**
     * Create and allocate a new ByteBuffer with a given size.
     */
    static allocate(byte_size) {
        return new ByteBuffer(new Uint8Array(byte_size));
    }
    clear() {
        this.position_ = 0;
    }
    /**
     * Get the underlying `Uint8Array`.
     */
    bytes() {
        return this.bytes_;
    }
    /**
     * Get the buffer's position.
     */
    position() {
        return this.position_;
    }
    /**
     * Set the buffer's position.
     */
    setPosition(position) {
        this.position_ = position;
    }
    /**
     * Get the buffer's capacity.
     */
    capacity() {
        return this.bytes_.length;
    }
    readInt8(offset) {
        return (this.readUint8(offset) << 24) >> 24;
    }
    readUint8(offset) {
        return this.bytes_[offset];
    }
    readInt16(offset) {
        return (this.readUint16(offset) << 16) >> 16;
    }
    readUint16(offset) {
        return this.bytes_[offset] | (this.bytes_[offset + 1] << 8);
    }
    readInt32(offset) {
        return (this.bytes_[offset] |
            (this.bytes_[offset + 1] << 8) |
            (this.bytes_[offset + 2] << 16) |
            (this.bytes_[offset + 3] << 24));
    }
    readUint32(offset) {
        return this.readInt32(offset) >>> 0;
    }
    readInt64(offset) {
        return BigInt.asIntN(64, BigInt(this.readUint32(offset)) +
            (BigInt(this.readUint32(offset + 4)) << BigInt(32)));
    }
    readUint64(offset) {
        return BigInt.asUintN(64, BigInt(this.readUint32(offset)) +
            (BigInt(this.readUint32(offset + 4)) << BigInt(32)));
    }
    readFloat32(offset) {
        int32[0] = this.readInt32(offset);
        return float32[0];
    }
    readFloat64(offset) {
        int32[isLittleEndian ? 0 : 1] = this.readInt32(offset);
        int32[isLittleEndian ? 1 : 0] = this.readInt32(offset + 4);
        return float64[0];
    }
    writeInt8(offset, value) {
        this.bytes_[offset] = value;
    }
    writeUint8(offset, value) {
        this.bytes_[offset] = value;
    }
    writeInt16(offset, value) {
        this.bytes_[offset] = value;
        this.bytes_[offset + 1] = value >> 8;
    }
    writeUint16(offset, value) {
        this.bytes_[offset] = value;
        this.bytes_[offset + 1] = value >> 8;
    }
    writeInt32(offset, value) {
        this.bytes_[offset] = value;
        this.bytes_[offset + 1] = value >> 8;
        this.bytes_[offset + 2] = value >> 16;
        this.bytes_[offset + 3] = value >> 24;
    }
    writeUint32(offset, value) {
        this.bytes_[offset] = value;
        this.bytes_[offset + 1] = value >> 8;
        this.bytes_[offset + 2] = value >> 16;
        this.bytes_[offset + 3] = value >> 24;
    }
    writeInt64(offset, value) {
        this.writeInt32(offset, Number(BigInt.asIntN(32, value)));
        this.writeInt32(offset + 4, Number(BigInt.asIntN(32, value >> BigInt(32))));
    }
    writeUint64(offset, value) {
        this.writeUint32(offset, Number(BigInt.asUintN(32, value)));
        this.writeUint32(offset + 4, Number(BigInt.asUintN(32, value >> BigInt(32))));
    }
    writeFloat32(offset, value) {
        float32[0] = value;
        this.writeInt32(offset, int32[0]);
    }
    writeFloat64(offset, value) {
        float64[0] = value;
        this.writeInt32(offset, int32[isLittleEndian ? 0 : 1]);
        this.writeInt32(offset + 4, int32[isLittleEndian ? 1 : 0]);
    }
    /**
     * Return the file identifier.   Behavior is undefined for FlatBuffers whose
     * schema does not include a file_identifier (likely points at padding or the
     * start of a the root vtable).
     */
    getBufferIdentifier() {
        if (this.bytes_.length <
            this.position_ + SIZEOF_INT + FILE_IDENTIFIER_LENGTH) {
            throw new Error('FlatBuffers: ByteBuffer is too short to contain an identifier.');
        }
        let result = '';
        for (let i = 0; i < FILE_IDENTIFIER_LENGTH; i++) {
            result += String.fromCharCode(this.readInt8(this.position_ + SIZEOF_INT + i));
        }
        return result;
    }
    /**
     * Look up a field in the vtable, return an offset into the object, or 0 if the
     * field is not present.
     */
    __offset(bb_pos, vtable_offset) {
        const vtable = bb_pos - this.readInt32(bb_pos);
        return vtable_offset < this.readInt16(vtable)
            ? this.readInt16(vtable + vtable_offset)
            : 0;
    }
    /**
     * Initialize any Table-derived type to point to the union at the given offset.
     */
    __union(t, offset) {
        t.bb_pos = offset + this.readInt32(offset);
        t.bb = this;
        return t;
    }
    /**
     * Create a JavaScript string from UTF-8 data stored inside the FlatBuffer.
     * This allocates a new string and converts to wide chars upon each access.
     *
     * To avoid the conversion to string, pass Encoding.UTF8_BYTES as the
     * "optionalEncoding" argument. This is useful for avoiding conversion when
     * the data will just be packaged back up in another FlatBuffer later on.
     *
     * @param offset
     * @param opt_encoding Defaults to UTF16_STRING
     */
    __string(offset, opt_encoding) {
        offset += this.readInt32(offset);
        const length = this.readInt32(offset);
        offset += SIZEOF_INT;
        const utf8bytes = this.bytes_.subarray(offset, offset + length);
        if (opt_encoding === Encoding.UTF8_BYTES)
            return utf8bytes;
        else
            return this.text_decoder_.decode(utf8bytes);
    }
    /**
     * Handle unions that can contain string as its member, if a Table-derived type then initialize it,
     * if a string then return a new one
     *
     * WARNING: strings are immutable in JS so we can't change the string that the user gave us, this
     * makes the behaviour of __union_with_string different compared to __union
     */
    __union_with_string(o, offset) {
        if (typeof o === 'string') {
            return this.__string(offset);
        }
        return this.__union(o, offset);
    }
    /**
     * Retrieve the relative offset stored at "offset"
     */
    __indirect(offset) {
        return offset + this.readInt32(offset);
    }
    /**
     * Get the start of data of a vector whose offset is stored at "offset" in this object.
     */
    __vector(offset) {
        return offset + this.readInt32(offset) + SIZEOF_INT; // data starts after the length
    }
    /**
     * Get the length of a vector whose offset is stored at "offset" in this object.
     */
    __vector_len(offset) {
        return this.readInt32(offset + this.readInt32(offset));
    }
    __has_identifier(ident) {
        if (ident.length != FILE_IDENTIFIER_LENGTH) {
            throw new Error('FlatBuffers: file identifier must be length ' + FILE_IDENTIFIER_LENGTH);
        }
        for (let i = 0; i < FILE_IDENTIFIER_LENGTH; i++) {
            if (ident.charCodeAt(i) != this.readInt8(this.position() + SIZEOF_INT + i)) {
                return false;
            }
        }
        return true;
    }
    /**
     * A helper function for generating list for obj api
     */
    createScalarList(listAccessor, listLength) {
        const ret = [];
        for (let i = 0; i < listLength; ++i) {
            const val = listAccessor(i);
            if (val !== null) {
                ret.push(val);
            }
        }
        return ret;
    }
    /**
     * A helper function for generating list for obj api
     * @param listAccessor function that accepts an index and return data at that index
     * @param listLength listLength
     * @param res result list
     */
    createObjList(listAccessor, listLength) {
        const ret = [];
        for (let i = 0; i < listLength; ++i) {
            const val = listAccessor(i);
            if (val !== null) {
                ret.push(val.unpack());
            }
        }
        return ret;
    }
}

;// ./node_modules/flatbuffers/mjs/builder.js


class Builder {
    /**
     * Create a FlatBufferBuilder.
     */
    constructor(opt_initial_size) {
        /** Minimum alignment encountered so far. */
        this.minalign = 1;
        /** The vtable for the current table. */
        this.vtable = null;
        /** The amount of fields we're actually using. */
        this.vtable_in_use = 0;
        /** Whether we are currently serializing a table. */
        this.isNested = false;
        /** Starting offset of the current struct/table. */
        this.object_start = 0;
        /** List of offsets of all vtables. */
        this.vtables = [];
        /** For the current vector being built. */
        this.vector_num_elems = 0;
        /** False omits default values from the serialized data */
        this.force_defaults = false;
        this.string_maps = null;
        this.text_encoder = new TextEncoder();
        let initial_size;
        if (!opt_initial_size) {
            initial_size = 1024;
        }
        else {
            initial_size = opt_initial_size;
        }
        /**
         * @type {ByteBuffer}
         * @private
         */
        this.bb = ByteBuffer.allocate(initial_size);
        this.space = initial_size;
    }
    clear() {
        this.bb.clear();
        this.space = this.bb.capacity();
        this.minalign = 1;
        this.vtable = null;
        this.vtable_in_use = 0;
        this.isNested = false;
        this.object_start = 0;
        this.vtables = [];
        this.vector_num_elems = 0;
        this.force_defaults = false;
        this.string_maps = null;
    }
    /**
     * In order to save space, fields that are set to their default value
     * don't get serialized into the buffer. Forcing defaults provides a
     * way to manually disable this optimization.
     *
     * @param forceDefaults true always serializes default values
     */
    forceDefaults(forceDefaults) {
        this.force_defaults = forceDefaults;
    }
    /**
     * Get the ByteBuffer representing the FlatBuffer. Only call this after you've
     * called finish(). The actual data starts at the ByteBuffer's current position,
     * not necessarily at 0.
     */
    dataBuffer() {
        return this.bb;
    }
    /**
     * Get the bytes representing the FlatBuffer. Only call this after you've
     * called finish().
     */
    asUint8Array() {
        return this.bb
            .bytes()
            .subarray(this.bb.position(), this.bb.position() + this.offset());
    }
    /**
     * Prepare to write an element of `size` after `additional_bytes` have been
     * written, e.g. if you write a string, you need to align such the int length
     * field is aligned to 4 bytes, and the string data follows it directly. If all
     * you need to do is alignment, `additional_bytes` will be 0.
     *
     * @param size This is the of the new element to write
     * @param additional_bytes The padding size
     */
    prep(size, additional_bytes) {
        // Track the biggest thing we've ever aligned to.
        if (size > this.minalign) {
            this.minalign = size;
        }
        // Find the amount of alignment needed such that `size` is properly
        // aligned after `additional_bytes`
        const align_size = (~(this.bb.capacity() - this.space + additional_bytes) + 1) & (size - 1);
        // Reallocate the buffer if needed.
        while (this.space < align_size + size + additional_bytes) {
            const old_buf_size = this.bb.capacity();
            this.bb = Builder.growByteBuffer(this.bb);
            this.space += this.bb.capacity() - old_buf_size;
        }
        this.pad(align_size);
    }
    pad(byte_size) {
        for (let i = 0; i < byte_size; i++) {
            this.bb.writeInt8(--this.space, 0);
        }
    }
    writeInt8(value) {
        this.bb.writeInt8((this.space -= 1), value);
    }
    writeInt16(value) {
        this.bb.writeInt16((this.space -= 2), value);
    }
    writeInt32(value) {
        this.bb.writeInt32((this.space -= 4), value);
    }
    writeInt64(value) {
        this.bb.writeInt64((this.space -= 8), value);
    }
    writeFloat32(value) {
        this.bb.writeFloat32((this.space -= 4), value);
    }
    writeFloat64(value) {
        this.bb.writeFloat64((this.space -= 8), value);
    }
    /**
     * Add an `int8` to the buffer, properly aligned, and grows the buffer (if necessary).
     * @param value The `int8` to add the buffer.
     */
    addInt8(value) {
        this.prep(1, 0);
        this.writeInt8(value);
    }
    /**
     * Add an `int16` to the buffer, properly aligned, and grows the buffer (if necessary).
     * @param value The `int16` to add the buffer.
     */
    addInt16(value) {
        this.prep(2, 0);
        this.writeInt16(value);
    }
    /**
     * Add an `int32` to the buffer, properly aligned, and grows the buffer (if necessary).
     * @param value The `int32` to add the buffer.
     */
    addInt32(value) {
        this.prep(4, 0);
        this.writeInt32(value);
    }
    /**
     * Add an `int64` to the buffer, properly aligned, and grows the buffer (if necessary).
     * @param value The `int64` to add the buffer.
     */
    addInt64(value) {
        this.prep(8, 0);
        this.writeInt64(value);
    }
    /**
     * Add a `float32` to the buffer, properly aligned, and grows the buffer (if necessary).
     * @param value The `float32` to add the buffer.
     */
    addFloat32(value) {
        this.prep(4, 0);
        this.writeFloat32(value);
    }
    /**
     * Add a `float64` to the buffer, properly aligned, and grows the buffer (if necessary).
     * @param value The `float64` to add the buffer.
     */
    addFloat64(value) {
        this.prep(8, 0);
        this.writeFloat64(value);
    }
    addFieldInt8(voffset, value, defaultValue) {
        if (this.force_defaults || value != defaultValue) {
            this.addInt8(value);
            this.slot(voffset);
        }
    }
    addFieldInt16(voffset, value, defaultValue) {
        if (this.force_defaults || value != defaultValue) {
            this.addInt16(value);
            this.slot(voffset);
        }
    }
    addFieldInt32(voffset, value, defaultValue) {
        if (this.force_defaults || value != defaultValue) {
            this.addInt32(value);
            this.slot(voffset);
        }
    }
    addFieldInt64(voffset, value, defaultValue) {
        if (this.force_defaults || value !== defaultValue) {
            this.addInt64(value);
            this.slot(voffset);
        }
    }
    addFieldFloat32(voffset, value, defaultValue) {
        if (this.force_defaults || value != defaultValue) {
            this.addFloat32(value);
            this.slot(voffset);
        }
    }
    addFieldFloat64(voffset, value, defaultValue) {
        if (this.force_defaults || value != defaultValue) {
            this.addFloat64(value);
            this.slot(voffset);
        }
    }
    addFieldOffset(voffset, value, defaultValue) {
        if (this.force_defaults || value != defaultValue) {
            this.addOffset(value);
            this.slot(voffset);
        }
    }
    /**
     * Structs are stored inline, so nothing additional is being added. `d` is always 0.
     */
    addFieldStruct(voffset, value, defaultValue) {
        if (value != defaultValue) {
            this.nested(value);
            this.slot(voffset);
        }
    }
    /**
     * Structures are always stored inline, they need to be created right
     * where they're used.  You'll get this assertion failure if you
     * created it elsewhere.
     */
    nested(obj) {
        if (obj != this.offset()) {
            throw new TypeError('FlatBuffers: struct must be serialized inline.');
        }
    }
    /**
     * Should not be creating any other object, string or vector
     * while an object is being constructed
     */
    notNested() {
        if (this.isNested) {
            throw new TypeError('FlatBuffers: object serialization must not be nested.');
        }
    }
    /**
     * Set the current vtable at `voffset` to the current location in the buffer.
     */
    slot(voffset) {
        if (this.vtable !== null)
            this.vtable[voffset] = this.offset();
    }
    /**
     * @returns Offset relative to the end of the buffer.
     */
    offset() {
        return this.bb.capacity() - this.space;
    }
    /**
     * Doubles the size of the backing ByteBuffer and copies the old data towards
     * the end of the new buffer (since we build the buffer backwards).
     *
     * @param bb The current buffer with the existing data
     * @returns A new byte buffer with the old data copied
     * to it. The data is located at the end of the buffer.
     *
     * uint8Array.set() formally takes {Array<number>|ArrayBufferView}, so to pass
     * it a uint8Array we need to suppress the type check:
     * @suppress {checkTypes}
     */
    static growByteBuffer(bb) {
        const old_buf_size = bb.capacity();
        // Ensure we don't grow beyond what fits in an int.
        if (old_buf_size & 0xc0000000) {
            throw new Error('FlatBuffers: cannot grow buffer beyond 2 gigabytes.');
        }
        const new_buf_size = old_buf_size << 1;
        const nbb = ByteBuffer.allocate(new_buf_size);
        nbb.setPosition(new_buf_size - old_buf_size);
        nbb.bytes().set(bb.bytes(), new_buf_size - old_buf_size);
        return nbb;
    }
    /**
     * Adds on offset, relative to where it will be written.
     *
     * @param offset The offset to add.
     */
    addOffset(offset) {
        this.prep(SIZEOF_INT, 0); // Ensure alignment is already done.
        this.writeInt32(this.offset() - offset + SIZEOF_INT);
    }
    /**
     * Start encoding a new object in the buffer.  Users will not usually need to
     * call this directly. The FlatBuffers compiler will generate helper methods
     * that call this method internally.
     */
    startObject(numfields) {
        this.notNested();
        if (this.vtable == null) {
            this.vtable = [];
        }
        this.vtable_in_use = numfields;
        for (let i = 0; i < numfields; i++) {
            this.vtable[i] = 0; // This will push additional elements as needed
        }
        this.isNested = true;
        this.object_start = this.offset();
    }
    /**
     * Finish off writing the object that is under construction.
     *
     * @returns The offset to the object inside `dataBuffer`
     */
    endObject() {
        if (this.vtable == null || !this.isNested) {
            throw new Error('FlatBuffers: endObject called without startObject');
        }
        this.addInt32(0);
        const vtableloc = this.offset();
        // Trim trailing zeroes.
        let i = this.vtable_in_use - 1;
        // eslint-disable-next-line no-empty
        for (; i >= 0 && this.vtable[i] == 0; i--) { }
        const trimmed_size = i + 1;
        // Write out the current vtable.
        for (; i >= 0; i--) {
            // Offset relative to the start of the table.
            this.addInt16(this.vtable[i] != 0 ? vtableloc - this.vtable[i] : 0);
        }
        const standard_fields = 2; // The fields below:
        this.addInt16(vtableloc - this.object_start);
        const len = (trimmed_size + standard_fields) * SIZEOF_SHORT;
        this.addInt16(len);
        // Search for an existing vtable that matches the current one.
        let existing_vtable = 0;
        const vt1 = this.space;
        outer_loop: for (i = 0; i < this.vtables.length; i++) {
            const vt2 = this.bb.capacity() - this.vtables[i];
            if (len == this.bb.readInt16(vt2)) {
                for (let j = SIZEOF_SHORT; j < len; j += SIZEOF_SHORT) {
                    if (this.bb.readInt16(vt1 + j) != this.bb.readInt16(vt2 + j)) {
                        continue outer_loop;
                    }
                }
                existing_vtable = this.vtables[i];
                break;
            }
        }
        if (existing_vtable) {
            // Found a match:
            // Remove the current vtable.
            this.space = this.bb.capacity() - vtableloc;
            // Point table to existing vtable.
            this.bb.writeInt32(this.space, existing_vtable - vtableloc);
        }
        else {
            // No match:
            // Add the location of the current vtable to the list of vtables.
            this.vtables.push(this.offset());
            // Point table to current vtable.
            this.bb.writeInt32(this.bb.capacity() - vtableloc, this.offset() - vtableloc);
        }
        this.isNested = false;
        return vtableloc;
    }
    /**
     * Finalize a buffer, poiting to the given `root_table`.
     */
    finish(root_table, opt_file_identifier, opt_size_prefix) {
        const size_prefix = opt_size_prefix ? SIZE_PREFIX_LENGTH : 0;
        if (opt_file_identifier) {
            const file_identifier = opt_file_identifier;
            this.prep(this.minalign, SIZEOF_INT + FILE_IDENTIFIER_LENGTH + size_prefix);
            if (file_identifier.length != FILE_IDENTIFIER_LENGTH) {
                throw new TypeError('FlatBuffers: file identifier must be length ' +
                    FILE_IDENTIFIER_LENGTH);
            }
            for (let i = FILE_IDENTIFIER_LENGTH - 1; i >= 0; i--) {
                this.writeInt8(file_identifier.charCodeAt(i));
            }
        }
        this.prep(this.minalign, SIZEOF_INT + size_prefix);
        this.addOffset(root_table);
        if (size_prefix) {
            this.addInt32(this.bb.capacity() - this.space);
        }
        this.bb.setPosition(this.space);
    }
    /**
     * Finalize a size prefixed buffer, pointing to the given `root_table`.
     */
    finishSizePrefixed(root_table, opt_file_identifier) {
        this.finish(root_table, opt_file_identifier, true);
    }
    /**
     * This checks a required field has been set in a given table that has
     * just been constructed.
     */
    requiredField(table, field) {
        const table_start = this.bb.capacity() - table;
        const vtable_start = table_start - this.bb.readInt32(table_start);
        const ok = field < this.bb.readInt16(vtable_start) &&
            this.bb.readInt16(vtable_start + field) != 0;
        // If this fails, the caller will show what field needs to be set.
        if (!ok) {
            throw new TypeError('FlatBuffers: field ' + field + ' must be set');
        }
    }
    /**
     * Start a new array/vector of objects.  Users usually will not call
     * this directly. The FlatBuffers compiler will create a start/end
     * method for vector types in generated code.
     *
     * @param elem_size The size of each element in the array
     * @param num_elems The number of elements in the array
     * @param alignment The alignment of the array
     */
    startVector(elem_size, num_elems, alignment) {
        this.notNested();
        this.vector_num_elems = num_elems;
        this.prep(SIZEOF_INT, elem_size * num_elems);
        this.prep(alignment, elem_size * num_elems); // Just in case alignment > int.
    }
    /**
     * Finish off the creation of an array and all its elements. The array must be
     * created with `startVector`.
     *
     * @returns The offset at which the newly created array
     * starts.
     */
    endVector() {
        this.writeInt32(this.vector_num_elems);
        return this.offset();
    }
    /**
     * Encode the string `s` in the buffer using UTF-8. If the string passed has
     * already been seen, we return the offset of the already written string
     *
     * @param s The string to encode
     * @return The offset in the buffer where the encoded string starts
     */
    createSharedString(s) {
        if (!s) {
            return 0;
        }
        if (!this.string_maps) {
            this.string_maps = new Map();
        }
        if (this.string_maps.has(s)) {
            return this.string_maps.get(s);
        }
        const offset = this.createString(s);
        this.string_maps.set(s, offset);
        return offset;
    }
    /**
     * Encode the string `s` in the buffer using UTF-8. If a Uint8Array is passed
     * instead of a string, it is assumed to contain valid UTF-8 encoded data.
     *
     * @param s The string to encode
     * @return The offset in the buffer where the encoded string starts
     */
    createString(s) {
        if (s === null || s === undefined) {
            return 0;
        }
        let utf8;
        if (s instanceof Uint8Array) {
            utf8 = s;
        }
        else {
            utf8 = this.text_encoder.encode(s);
        }
        this.addInt8(0);
        this.startVector(1, utf8.length, 1);
        this.bb.setPosition((this.space -= utf8.length));
        this.bb.bytes().set(utf8, this.space);
        return this.endVector();
    }
    /**
     * Create a byte vector.
     *
     * @param v The bytes to add
     * @returns The offset in the buffer where the byte vector starts
     */
    createByteVector(v) {
        if (v === null || v === undefined) {
            return 0;
        }
        this.startVector(1, v.length, 1);
        this.bb.setPosition((this.space -= v.length));
        this.bb.bytes().set(v, this.space);
        return this.endVector();
    }
    /**
     * A helper function to pack an object
     *
     * @returns offset of obj
     */
    createObjectOffset(obj) {
        if (obj === null) {
            return 0;
        }
        if (typeof obj === 'string') {
            return this.createString(obj);
        }
        else {
            return obj.pack(this);
        }
    }
    /**
     * A helper function to pack a list of object
     *
     * @returns list of offsets of each non null object
     */
    createObjectOffsetList(list) {
        const ret = [];
        for (let i = 0; i < list.length; ++i) {
            const val = list[i];
            if (val !== null) {
                ret.push(this.createObjectOffset(val));
            }
            else {
                throw new TypeError('FlatBuffers: Argument for createObjectOffsetList cannot contain null.');
            }
        }
        return ret;
    }
    createStructOffsetList(list, startFunc) {
        startFunc(this, list.length);
        this.createObjectOffsetList(list.slice().reverse());
        return this.endVector();
    }
}

;// ./node_modules/flatbuffers/mjs/flatbuffers.js







/***/ }),

/***/ 8733:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.KnownResourceSize = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class KnownResourceSize {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsKnownResourceSize(bb, obj) {
        return (obj || new KnownResourceSize()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsKnownResourceSize(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new KnownResourceSize()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    size() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readUint64(this.bb_pos + offset) : BigInt('0');
    }
    static startKnownResourceSize(builder) {
        builder.startObject(1);
    }
    static addSize(builder, size) {
        builder.addFieldInt64(0, size, BigInt('0'));
    }
    static endKnownResourceSize(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createKnownResourceSize(builder, size) {
        KnownResourceSize.startKnownResourceSize(builder);
        KnownResourceSize.addSize(builder, size);
        return KnownResourceSize.endKnownResourceSize(builder);
    }
}
exports.KnownResourceSize = KnownResourceSize;


/***/ }),

/***/ 8778:
/***/ ((__unused_webpack_module, exports) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.supportedPlayerTypes = exports.supportedImageExtensions = exports.supportedImageTypes = exports.supportedAudioTypes = exports.supportedVideoExtensions = exports.supportedVideoTypes = exports.streamingMediaTypes = void 0;
exports.streamingMediaTypes = [
    'application/vnd.apple.mpegurl',
    'application/x-mpegURL',
    'application/dash+xml',
    'application/x-whep'
];
exports.supportedVideoTypes = [
    'video/mp4',
    'video/mpeg',
    'video/ogg',
    'video/webm',
    'video/x-matroska',
    'video/3gpp',
    'video/3gpp2',
];
exports.supportedVideoExtensions = [
    '.mp4', '.m4v',
    '.webm',
    '.mkv',
    '.3gp',
    '.3g2',
];
exports.supportedAudioTypes = [
    'audio/aac',
    'audio/flac',
    'audio/x-flac',
    'audio/mpeg',
    'audio/mp4',
    'audio/ogg',
    'audio/wav',
    'audio/webm',
    'audio/3gpp',
    'audio/3gpp2',
];
exports.supportedImageTypes = [
    'image/apng',
    'image/avif',
    'image/bmp',
    'image/gif',
    'image/x-icon',
    'image/jpeg',
    'image/png',
    'image/svg+xml',
    'image/vnd.microsoft.icon',
    'image/webp',
];
exports.supportedImageExtensions = [
    '.apng',
    '.avif',
    '.bmp',
    '.gif',
    '.ico',
    '.jpeg', '.jpg', '.jpe', '.jif', '.jfif', '.jfi',
    '.png',
    '.svg',
    '.webp',
];
exports.supportedPlayerTypes = exports.streamingMediaTypes.concat(exports.supportedVideoTypes, exports.supportedAudioTypes);


/***/ }),

/***/ 8819:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.deepEqual = deepEqual;
exports.preparePlayMessage = preparePlayMessage;
exports.fetchJSON = fetchJSON;
exports.downloadFile = downloadFile;
const fs = __importStar(__webpack_require__(9896));
const url = __importStar(__webpack_require__(7016));
const follow_redirects_1 = __webpack_require__(3640);
const memfs = __importStar(__webpack_require__(5965));
const Logger_1 = __webpack_require__(1943);
const MimeTypes_1 = __webpack_require__(8778);
const NetworkService_1 = __webpack_require__(3530);
const Packets_1 = __webpack_require__(834);
const logger = new Logger_1.Logger('UtilityBackend', Logger_1.LoggerType.BACKEND);
function deepEqual(x, y) {
    const ok = Object.keys, tx = typeof x, ty = typeof y;
    return x && y && tx === 'object' && tx === ty ? (ok(x).length === ok(y).length &&
        ok(x).every(key => deepEqual(x[key], y[key]))) : (x === y);
}
async function preparePlayMessage(message, mediaCacheInitializationCb) {
    const proxyUrl = await NetworkService_1.NetworkService.proxyPlayIfRequired(message);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let rendererMessage = message;
    let rendererEvent = 'play';
    let contentViewer = MimeTypes_1.supportedPlayerTypes.find(v => v === message.container.toLocaleLowerCase()) ? 'player' : 'viewer';
    if (message.container === 'application/json') {
        const json = message.url ? await fetchJSON(message.url) : JSON.parse(message.content);
        if (json && json.contentType !== undefined) {
            switch (json.contentType) {
                case Packets_1.ContentType.Playlist: {
                    rendererMessage = json;
                    rendererEvent = 'play-playlist';
                    mediaCacheInitializationCb(rendererMessage);
                    const offset = rendererMessage.offset ? rendererMessage.offset : 0;
                    contentViewer = MimeTypes_1.supportedPlayerTypes.find(v => v === rendererMessage.items[offset].container.toLocaleLowerCase()) ? 'player' : 'viewer';
                    break;
                }
                default:
                    break;
            }
        }
    }
    return { rendererEvent: rendererEvent, rendererMessage: rendererMessage, proxyUrl: proxyUrl, contentViewer: contentViewer };
}
async function fetchJSON(url) {
    const protocol = url.startsWith('https') ? follow_redirects_1.https : follow_redirects_1.http;
    return new Promise((resolve, reject) => {
        protocol.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    resolve(JSON.parse(data));
                }
                catch (err) {
                    reject(err);
                }
            });
        }).on('error', (err) => {
            reject(err);
        });
    });
}
async function downloadFile(downloadUrl, destination, inMemory = false, requestHeaders = null, startCb = null, progressCb = null) {
    return new Promise((resolve, reject) => {
        const file = inMemory ? memfs.fs.createWriteStream(destination) : fs.createWriteStream(destination);
        const protocol = downloadUrl.startsWith('https') ? follow_redirects_1.https : follow_redirects_1.http;
        const parsedUrl = url.parse(downloadUrl);
        const options = {
            ...parsedUrl,
            headers: requestHeaders
        };
        protocol.get(options, (response) => {
            const downloadSize = Number(response.headers['content-length']);
            logger.info(`Downloading file ${downloadUrl} to ${destination} with size: ${downloadSize} bytes`);
            if (startCb) {
                if (!startCb(downloadSize)) {
                    file.close();
                    reject('Error: Aborted download');
                }
            }
            response.pipe(file);
            let downloadedBytes = 0;
            response.on('data', (chunk) => {
                downloadedBytes += chunk.length;
                if (progressCb) {
                    progressCb(downloadedBytes, downloadSize);
                }
            });
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', (err) => {
            file.close();
            reject(err);
        });
    });
}


/***/ }),

/***/ 8831:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GenericMetaFloat = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class GenericMetaFloat {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsGenericMetaFloat(bb, obj) {
        return (obj || new GenericMetaFloat()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsGenericMetaFloat(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new GenericMetaFloat()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    value() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readFloat64(this.bb_pos + offset) : 0.0;
    }
    static startGenericMetaFloat(builder) {
        builder.startObject(1);
    }
    static addValue(builder, value) {
        builder.addFieldFloat64(0, value, 0.0);
    }
    static endGenericMetaFloat(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createGenericMetaFloat(builder, value) {
        GenericMetaFloat.startGenericMetaFloat(builder);
        GenericMetaFloat.addValue(builder, value);
        return GenericMetaFloat.endGenericMetaFloat(builder);
    }
}
exports.GenericMetaFloat = GenericMetaFloat;


/***/ }),

/***/ 8866:
/***/ ((module) => {

"use strict";

var nextTick = nextTickArgs;
process.nextTick(upgrade, 42); // pass 42 and see if upgrade is called with it
module.exports = thunky;
function thunky(fn) {
    var state = run;
    return thunk;
    function thunk(callback) {
        state(callback || noop);
    }
    function run(callback) {
        var stack = [callback];
        state = wait;
        fn(done);
        function wait(callback) {
            stack.push(callback);
        }
        function done(err) {
            var args = arguments;
            state = isError(err) ? run : finished;
            while (stack.length)
                finished(stack.shift());
            function finished(callback) {
                nextTick(apply, callback, args);
            }
        }
    }
}
function isError(err) {
    return Object.prototype.toString.call(err) === '[object Error]';
}
function noop() { }
function apply(callback, args) {
    callback.apply(null, args);
}
function upgrade(val) {
    if (val === 42)
        nextTick = process.nextTick;
}
function nextTickArgs(fn, a, b) {
    process.nextTick(function () {
        fn(a, b);
    });
}


/***/ }),

/***/ 8930:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
const tslib_1 = __webpack_require__(2851);
tslib_1.__exportStar(__webpack_require__(5257), exports);
tslib_1.__exportStar(__webpack_require__(4200), exports);
tslib_1.__exportStar(__webpack_require__(4683), exports);


/***/ }),

/***/ 9023:
/***/ ((module) => {

"use strict";
module.exports = require("util");

/***/ }),

/***/ 9028:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.WrappedGenericMetaValue = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const generic_meta_value_1 = __webpack_require__(1620);
class WrappedGenericMetaValue {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsWrappedGenericMetaValue(bb, obj) {
        return (obj || new WrappedGenericMetaValue()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsWrappedGenericMetaValue(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new WrappedGenericMetaValue()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    valueType() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readUint8(this.bb_pos + offset) : generic_meta_value_1.GenericMetaValue.NONE;
    }
    value(obj) {
        const offset = this.bb.__offset(this.bb_pos, 6);
        return offset ? this.bb.__union(obj, this.bb_pos + offset) : null;
    }
    static startWrappedGenericMetaValue(builder) {
        builder.startObject(2);
    }
    static addValueType(builder, valueType) {
        builder.addFieldInt8(0, valueType, generic_meta_value_1.GenericMetaValue.NONE);
    }
    static addValue(builder, valueOffset) {
        builder.addFieldOffset(1, valueOffset, 0);
    }
    static endWrappedGenericMetaValue(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createWrappedGenericMetaValue(builder, valueType, valueOffset) {
        WrappedGenericMetaValue.startWrappedGenericMetaValue(builder);
        WrappedGenericMetaValue.addValueType(builder, valueType);
        WrappedGenericMetaValue.addValue(builder, valueOffset);
        return WrappedGenericMetaValue.endWrappedGenericMetaValue(builder);
    }
}
exports.WrappedGenericMetaValue = WrappedGenericMetaValue;


/***/ }),

/***/ 9084:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.VideoTrackMeta = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
const video_resolution_1 = __webpack_require__(813);
class VideoTrackMeta {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsVideoTrackMeta(bb, obj) {
        return (obj || new VideoTrackMeta()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsVideoTrackMeta(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new VideoTrackMeta()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    resolution(obj) {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? (obj || new video_resolution_1.VideoResolution()).__init(this.bb_pos + offset, this.bb) : null;
    }
    static startVideoTrackMeta(builder) {
        builder.startObject(1);
    }
    static addResolution(builder, resolutionOffset) {
        builder.addFieldStruct(0, resolutionOffset, 0);
    }
    static endVideoTrackMeta(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createVideoTrackMeta(builder, resolutionOffset) {
        VideoTrackMeta.startVideoTrackMeta(builder);
        VideoTrackMeta.addResolution(builder, resolutionOffset);
        return VideoTrackMeta.endVideoTrackMeta(builder);
    }
}
exports.VideoTrackMeta = VideoTrackMeta;


/***/ }),

/***/ 9108:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.FCastSession = void 0;
const events_1 = __webpack_require__(4434);
const Packets_1 = __webpack_require__(834);
const Logger_1 = __webpack_require__(1943);
const Main_1 = __webpack_require__(1759);
const uuid_1 = __webpack_require__(206);
const Packets_2 = __webpack_require__(834);
const Codec_1 = __webpack_require__(3196);
const logger = new Logger_1.Logger('FCastSession', Logger_1.LoggerType.BACKEND);
var SessionState;
(function (SessionState) {
    SessionState[SessionState["Idle"] = 0] = "Idle";
    SessionState[SessionState["WaitingForLength"] = 1] = "WaitingForLength";
    SessionState[SessionState["WaitingForData"] = 2] = "WaitingForData";
    SessionState[SessionState["Disconnected"] = 3] = "Disconnected";
})(SessionState || (SessionState = {}));
;
const LENGTH_BYTES = 4;
const MAXIMUM_PACKET_LENGTH = 32000;
const V4_MAXIMUM_PACKET_LENGTH = 512 * 1024;
const V4_DEFAULT_PROGRESS_INTERVAL_MS = 500;
const COMPANION_REQUEST_TIMEOUT_MS = 30000;
class FCastSession {
    constructor(socket, writer, v4Config = null) {
        this.remoteAddress = null;
        this.buffer = Buffer.alloc(MAXIMUM_PACKET_LENGTH);
        this.bytesRead = 0;
        this.packetLength = 0;
        this.emitter = new events_1.EventEmitter();
        // Called with the bytes that followed the sender's v4 `Version` packet; they are the start of
        // the TLS handshake. The listener upgrades the connection and then calls `completeV4Upgrade`.
        this.onUpgradeRequest = null;
        // When the last packet arrived, for the v4 heartbeat.
        this.lastPacketAt = Date.now();
        this.maximumPacketLength = MAXIMUM_PACKET_LENGTH;
        // Nothing but our own `Version` is sent until the sender's first packet: a sender that is
        // still negotiating treats any other message as a protocol error.
        this.active = false;
        this.upgrading = false;
        this.upgradePending = false;
        this.packetsReceived = 0;
        // v4 state for translating v2/v3 updates into v4 messages
        this.progressIntervalMs = V4_DEFAULT_PROGRESS_INTERVAL_MS;
        this.lastState = null;
        this.lastSpeed = null;
        this.lastProgressTime = null;
        this.lastProgressSentAt = 0;
        // The player reports about once a second; between reports the position is extrapolated so
        // senders get progress at the interval they asked for.
        this.lastUpdate = null;
        this.lastUpdateAt = 0;
        this.progressTimer = null;
        this.progressTimerMs = 0;
        this.mirroringSessionId = null;
        this.companionRequests = new Map();
        this.nextCompanionRequestId = 0;
        this.sessionId = (0, uuid_1.v4)();
        // Not all senders send a version message to the receiver on connection. Choosing version 2
        // as the base version since most/all current senders support this version.
        this.protocolVersion = 2;
        this.sentInitialMessage = false;
        this.socket = socket;
        this.writer = writer;
        this.v4Config = v4Config;
        this.state = SessionState.WaitingForLength;
    }
    // The highest protocol version this session can offer to the sender.
    get maximumVersion() {
        return this.v4Config !== null ? Packets_1.V4_PROTOCOL_VERSION : Packets_1.PROTOCOL_VERSION;
    }
    get isV4() {
        return this.protocolVersion >= Packets_1.V4_PROTOCOL_VERSION && !this.upgrading;
    }
    sendVersion() {
        this.writePacket(Packets_1.Opcode.Version, Buffer.from(JSON.stringify(new Packets_1.VersionMessage(this.maximumVersion)), 'utf8'));
    }
    send(opcode, message = null) {
        if (!this.active || this.upgrading) {
            return;
        }
        if (this.protocolVersion >= Packets_1.V4_PROTOCOL_VERSION) {
            this.sendV4(opcode, message);
            return;
        }
        if (!this.isSupportedOpcode(opcode)) {
            return;
        }
        message = this.stripUnsupportedFields(opcode, message);
        const json = message ? JSON.stringify(message) : null;
        logger.info(`send: (session: ${this.sessionId}, opcode: ${opcode}, body: ${json})`);
        let data;
        if (json) {
            // Do NOT use the TextEncoder utility class, it does not exist in the NodeJS runtime
            // for webOS 6.0 and earlier...
            data = Buffer.from(json, 'utf8');
        }
        else {
            data = Buffer.alloc(0);
        }
        this.writePacket(opcode, data);
    }
    writePacket(opcode, data) {
        const size = 1 + data.length;
        const header = Buffer.alloc(4 + 1);
        // Not `writeUint32LE`: that spelling only exists since Node 12.19/14.9, and TV runtimes are
        // older (upstream hit this on webOS 22). `writeUInt32LE` is in every Node version.
        header.writeUInt32LE(size, 0);
        header[4] = opcode;
        let packet;
        if (data.length > 0) {
            packet = Buffer.concat([header, data]);
        }
        else {
            packet = header;
        }
        this.writer(packet);
    }
    close() {
        this.socket.end();
    }
    // Called by the listener once the connection is gone.
    closed() {
        this.stopProgressTimer();
        const error = new Error('the sender disconnected');
        this.companionRequests.forEach((request) => {
            clearTimeout(request.timer);
            request.reject(error);
        });
        this.companionRequests.clear();
    }
    processBytes(receivedBytes) {
        //TODO: Multithreading?
        if (receivedBytes.length == 0) {
            return;
        }
        logger.debug(`${receivedBytes.length} bytes received`);
        switch (this.state) {
            case SessionState.WaitingForLength:
                this.handleLengthBytes(receivedBytes);
                break;
            case SessionState.WaitingForData:
                this.handlePacketBytes(receivedBytes);
                break;
            default:
                logger.warn(`Data received is unhandled in current session state ${this.state}.`);
                break;
        }
    }
    handleLengthBytes(receivedBytes) {
        const remaining = LENGTH_BYTES - this.bytesRead;
        const bytesToRead = Math.min(remaining, receivedBytes.length);
        const bytesRemaining = receivedBytes.length - bytesToRead;
        receivedBytes.copy(this.buffer, this.bytesRead, 0, bytesToRead);
        this.bytesRead += bytesToRead;
        logger.debug(`handleLengthBytes: Read ${bytesToRead} bytes from packet`);
        if (this.bytesRead >= LENGTH_BYTES) {
            this.state = SessionState.WaitingForData;
            this.packetLength = this.buffer.readUInt32LE(0);
            this.bytesRead = 0;
            logger.debug(`Packet length header received from: ${this.packetLength}`);
            if (this.packetLength > this.maximumPacketLength) {
                throw new Error(`Maximum packet length is ${this.maximumPacketLength} bytes: ${this.packetLength}`);
            }
            if (this.packetLength === 0 && this.protocolVersion >= Packets_1.V4_PROTOCOL_VERSION) {
                throw new Error('Received a packet without an opcode');
            }
            if (bytesRemaining > 0) {
                logger.debug(`${bytesRemaining} remaining bytes pushed to handlePacketBytes`);
                this.handlePacketBytes(receivedBytes.slice(bytesToRead));
            }
        }
    }
    handlePacketBytes(receivedBytes) {
        const remaining = this.packetLength - this.bytesRead;
        const bytesToRead = Math.min(remaining, receivedBytes.length);
        const bytesRemaining = receivedBytes.length - bytesToRead;
        receivedBytes.copy(this.buffer, this.bytesRead, 0, bytesToRead);
        this.bytesRead += bytesToRead;
        logger.debug(`handlePacketBytes: Read ${bytesToRead} bytes from packet`);
        if (this.bytesRead >= this.packetLength) {
            logger.debug(`handlePacketBytes: Finished handling packet with ${this.packetLength} bytes. Total bytes read ${this.bytesRead}.`);
            this.handleNextPacket();
            this.state = SessionState.WaitingForLength;
            this.packetLength = 0;
            this.bytesRead = 0;
            if (this.upgradePending) {
                // Everything after the `Version` packet belongs to the TLS handshake.
                this.upgradePending = false;
                this.upgrading = true;
                this.onUpgradeRequest(Buffer.from(receivedBytes.slice(bytesToRead)));
                return;
            }
            if (bytesRemaining > 0) {
                logger.debug(`${bytesRemaining} remaining bytes pushed to handleLengthBytes`);
                this.handleLengthBytes(receivedBytes.slice(bytesToRead));
            }
        }
    }
    // Called by the listener once the TLS handshake finished; `writer` writes to the TLS stream.
    completeV4Upgrade(socket, writer) {
        this.socket = socket;
        this.writer = writer;
        this.protocolVersion = Packets_1.V4_PROTOCOL_VERSION;
        this.maximumPacketLength = V4_MAXIMUM_PACKET_LENGTH;
        this.buffer = Buffer.alloc(V4_MAXIMUM_PACKET_LENGTH);
        this.upgrading = false;
        logger.info(`Session ${this.sessionId} upgraded to protocol v4`);
        this.sendV4Message((0, Codec_1.encodeReceiverIntroduction)({ displayName: (0, Main_1.getComputerName)(), appName: (0, Main_1.getAppName)(), appVersion: (0, Main_1.getAppVersion)() }, this.v4Config.mediaCapabilities, this.v4Config.volumeStepInterval));
        const volume = (0, Main_1.getPlayerVolume)();
        if (volume !== null && volume !== undefined) {
            this.sendV4Message((0, Codec_1.encodeVolumeChanged)(volume));
        }
        // A sender joining mid-playback learns what's loaded (without request headers), its tracks
        // and its state.
        const join = (0, Main_1.getV4JoinMessages)();
        join.forEach((message) => this.sendV4Message(message));
        const update = (0, Main_1.getPlaybackUpdateMessage)();
        if (join.length > 0 && update) {
            this.sendV4PlaybackUpdate(update);
        }
        this.emitter.emit("version", new Packets_1.VersionMessage(Packets_1.V4_PROTOCOL_VERSION));
    }
    handlePacket(opcode, body, origin) {
        logger.info(`handlePacket: (session: ${this.sessionId}, opcode: ${opcode}, body: ${body})`);
        try {
            switch (opcode) {
                case Packets_1.Opcode.Play:
                    this.emitter.emit("play", JSON.parse(body), origin);
                    break;
                case Packets_1.Opcode.Pause:
                    this.emitter.emit("pause", origin);
                    break;
                case Packets_1.Opcode.Resume:
                    this.emitter.emit("resume", origin);
                    break;
                case Packets_1.Opcode.Stop:
                    this.emitter.emit("stop", origin);
                    break;
                case Packets_1.Opcode.Seek:
                    this.emitter.emit("seek", JSON.parse(body), origin);
                    break;
                case Packets_1.Opcode.SetVolume:
                    this.emitter.emit("setvolume", JSON.parse(body), origin);
                    break;
                case Packets_1.Opcode.SetSpeed:
                    this.emitter.emit("setspeed", JSON.parse(body), origin);
                    break;
                case Packets_1.Opcode.Version: {
                    const versionMessage = JSON.parse(body);
                    if (versionMessage.version >= Packets_1.V4_PROTOCOL_VERSION && this.v4Config !== null && this.onUpgradeRequest !== null) {
                        // Both sides speak v4: upgrade this connection to TLS in place.
                        this.upgradePending = true;
                        break;
                    }
                    // The side with the higher version downgrades to the other's.
                    if (versionMessage.version > 0) {
                        this.protocolVersion = Math.min(versionMessage.version, Packets_1.PROTOCOL_VERSION);
                    }
                    if (!this.sentInitialMessage && this.protocolVersion >= 3) {
                        this.send(Packets_1.Opcode.Initial, new Packets_1.InitialReceiverMessage((0, Main_1.getComputerName)(), (0, Main_1.getAppName)(), (0, Main_1.getAppVersion)(), (0, Main_1.getPlayMessage)(), new Packets_2.ReceiverCapabilities(new Packets_2.AVCapabilities(new Packets_2.LivestreamCapabilities(true)))));
                        const updateMessage = (0, Main_1.getPlaybackUpdateMessage)();
                        if (updateMessage) {
                            this.send(Packets_1.Opcode.PlaybackUpdate, updateMessage);
                        }
                        this.sentInitialMessage = true;
                    }
                    this.emitter.emit("version", versionMessage);
                    break;
                }
                case Packets_1.Opcode.Ping:
                    this.send(Packets_1.Opcode.Pong);
                    this.emitter.emit("ping");
                    break;
                case Packets_1.Opcode.Pong:
                    this.emitter.emit("pong");
                    break;
                case Packets_1.Opcode.Initial:
                    this.emitter.emit("initial", JSON.parse(body));
                    break;
                case Packets_1.Opcode.SetPlaylistItem:
                    this.emitter.emit("setplaylistitem", JSON.parse(body), origin);
                    break;
                case Packets_1.Opcode.SubscribeEvent:
                    this.emitter.emit("subscribeevent", JSON.parse(body));
                    break;
                case Packets_1.Opcode.UnsubscribeEvent:
                    this.emitter.emit("unsubscribeevent", JSON.parse(body));
                    break;
            }
        }
        catch (e) {
            logger.warn(`Error handling packet from.`, e);
        }
    }
    handleNextPacket() {
        const opcode = this.buffer[0];
        const origin = { sessionId: this.sessionId, packetNumber: this.packetsReceived };
        this.packetsReceived += 1;
        this.lastPacketAt = Date.now();
        if (!this.active) {
            this.active = true;
            if (opcode !== Packets_1.Opcode.Version) {
                logger.info(`Session ${this.sessionId} started without a version message, assuming v${this.protocolVersion}`);
            }
        }
        if (this.protocolVersion >= Packets_1.V4_PROTOCOL_VERSION) {
            this.handlePacketV4(opcode, this.buffer.subarray(1, this.packetLength), origin);
            return;
        }
        const body = this.packetLength > 1 ? this.buffer.toString('utf8', 1, this.packetLength) : null;
        this.handlePacket(opcode, body, origin);
    }
    handlePacketV4(opcode, body, origin) {
        switch (opcode) {
            case Packets_1.Opcode.Ping:
                this.writePacket(Packets_1.Opcode.Pong, Buffer.alloc(0));
                this.emitter.emit("ping");
                return;
            case Packets_1.Opcode.Pong:
                this.emitter.emit("pong");
                return;
            case Packets_1.Opcode.Resource:
                this.handleResourcePacket(body, origin);
                return;
            case Packets_1.Opcode.Flatbuf:
                break;
            default:
                logger.warn(`Session ${this.sessionId}: opcode ${opcode} is invalid in protocol v4`);
                this.sendV4Error(Codec_1.ErrorKind.InvalidOpcode, origin.packetNumber);
                return;
        }
        let message;
        try {
            message = (0, Codec_1.decodeV4)(body);
        }
        catch (e) {
            logger.warn(`Session ${this.sessionId}: malformed v4 message`, e);
            this.sendV4Error(e instanceof Codec_1.V4DecodeError ? Codec_1.ErrorKind.MalformedBody : Codec_1.ErrorKind.Internal, origin.packetNumber);
            return;
        }
        logger.info(`handlePacketV4: (session: ${this.sessionId}, message: ${message.type})`);
        switch (message.type) {
            case 'load':
                this.emitter.emit("play", message.play, origin);
                break;
            case 'seek':
                this.emitter.emit("seek", new Packets_1.SeekMessage(message.time), origin);
                break;
            case 'volume': {
                const volume = isNaN(message.volume) ? 0 : Math.min(1, Math.max(0, message.volume));
                if (volume !== message.volume) {
                    this.sendV4Error(Codec_1.ErrorKind.VolumeOutOfRange, origin.packetNumber);
                }
                this.emitter.emit("setvolume", new Packets_1.SetVolumeMessage(volume), origin);
                break;
            }
            case 'speed': {
                // Browsers can't play backwards, so only positive rates are valid here.
                const valid = isFinite(message.speed) && message.speed > 0;
                if (!valid) {
                    this.sendV4Error(Codec_1.ErrorKind.RateOutOfRange, origin.packetNumber);
                }
                this.emitter.emit("setspeed", new Packets_1.SetSpeedMessage(valid ? message.speed : 1), origin);
                break;
            }
            case 'playbackState':
                switch (message.state) {
                    case Codec_1.V4PlaybackState.Playing:
                        this.emitter.emit("resume", origin);
                        break;
                    case Codec_1.V4PlaybackState.Paused:
                        this.emitter.emit("pause", origin);
                        break;
                    case Codec_1.V4PlaybackState.Idle:
                    case Codec_1.V4PlaybackState.Ended:
                        this.emitter.emit("stop", origin);
                        break;
                    default:
                        // Like the reference receiver, requests for other states are ignored.
                        break;
                }
                break;
            case 'stop':
                this.emitter.emit("stop", origin);
                break;
            case 'queueItemSelected':
                this.emitter.emit("queueselect", { position: message.position }, origin);
                break;
            case 'queueInsert':
                this.emitter.emit("queueinsert", { item: message.item, position: message.position }, origin);
                break;
            case 'queueRemove':
                this.emitter.emit("queueremove", { position: message.position }, origin);
                break;
            case 'changeTrack':
                this.emitter.emit("changetrack", { trackType: message.trackType, id: message.id }, origin);
                break;
            case 'addSubtitleSource':
                this.emitter.emit("addsubtitle", { url: message.url, select: message.select, name: message.name }, origin);
                break;
            case 'senderIntroduction':
                this.emitter.emit("initial", new Packets_1.InitialSenderMessage(message.deviceInfo.displayName, message.deviceInfo.appName, message.deviceInfo.appVersion));
                break;
            case 'progressUpdateInterval':
                // Per spec: at least 100ms, rounded to the closest 100ms.
                this.progressIntervalMs = Math.max(100, Math.round(message.intervalMs / 100) * 100);
                this.updateProgressTimer();
                break;
            case 'startMirroringSession':
                this.mirroringSessionId = message.sessionId;
                this.emitter.emit("mirroringstart", { mirroringSessionId: message.sessionId }, origin);
                break;
            case 'mirroringSessionDescription':
                // Only the announced session's offer is valid.
                if (message.sessionId !== this.mirroringSessionId) {
                    this.sendV4Error(Codec_1.ErrorKind.InvalidState, origin.packetNumber);
                }
                else {
                    this.emitter.emit("mirroringoffer", { sdp: message.sdp }, origin);
                }
                break;
            case 'companionHelloRequest':
                this.emitter.emit("companionhello", origin);
                break;
            case 'companionResourceInfoResponse': {
                const request = this.takeCompanionRequest(message.requestId);
                if (request) {
                    request.resolve({ contentType: message.contentType, size: message.size });
                }
                break;
            }
            case 'unsupported':
                // Receiver-to-sender messages and anything else a sender shouldn't send.
                this.sendV4Error(Codec_1.ErrorKind.InvalidPayloadType, origin.packetNumber);
                break;
        }
    }
    // ---- v4: messages the receiver sends ------------------------------------------------------
    // Writes a v4 FlatBuffers message; a no-op for sessions that aren't (yet) on v4.
    sendV4Message(data) {
        if (this.protocolVersion >= Packets_1.V4_PROTOCOL_VERSION && !this.upgrading) {
            this.writePacket(Packets_1.Opcode.Flatbuf, data);
        }
    }
    // A no-op for v2/v3 senders, which have no equivalent. (Runtimes without v4 can't even build
    // the message.)
    sendV4Error(kind, packetNumber) {
        if (this.isV4) {
            this.sendV4Message((0, Codec_1.encodeError)(kind, packetNumber));
        }
    }
    // Playback states the v2/v3 model can't express (Buffering, Ended).
    sendV4PlaybackState(state) {
        if (this.isV4 && state !== this.lastState) {
            this.lastState = state;
            this.sendV4Message((0, Codec_1.encodePlaybackStateChanged)(state));
            this.updateProgressTimer();
        }
    }
    // Confirms a speed change even when nothing changed, like the reference receiver.
    sendV4Speed(speed) {
        if (this.isV4) {
            this.lastSpeed = speed;
            this.sendV4Message((0, Codec_1.encodeSpeedChanged)(speed));
        }
    }
    sendCompanionHelloResponse(providerId) {
        this.sendV4Message((0, Codec_1.encodeCompanionHelloResponse)(providerId));
    }
    sendMirroringAnswer(sdp) {
        if (!this.isV4 || this.mirroringSessionId === null) {
            return false;
        }
        this.sendV4Message((0, Codec_1.encodeMirroringSessionDescription)(this.mirroringSessionId, sdp));
        return true;
    }
    // ---- v4: FCompanion (media served by the sender over this connection) -----------------------
    startCompanionRequest(build, collectParts) {
        if (!this.isV4) {
            return Promise.reject(new Error('not a v4 session'));
        }
        const requestId = this.nextCompanionRequestId;
        this.nextCompanionRequestId = (this.nextCompanionRequestId + 1) >>> 0;
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                this.companionRequests.delete(requestId);
                reject(new Error(`companion request ${requestId} timed out`));
            }, COMPANION_REQUEST_TIMEOUT_MS);
            this.companionRequests.set(requestId, { resolve, reject, timer, parts: collectParts ? [] : undefined });
            this.sendV4Message(build(requestId));
        });
    }
    takeCompanionRequest(requestId) {
        const request = this.companionRequests.get(requestId);
        if (!request) {
            logger.warn(`Session ${this.sessionId}: response to unknown companion request ${requestId}`);
            return null;
        }
        clearTimeout(request.timer);
        this.companionRequests.delete(requestId);
        return request;
    }
    companionResourceInfo(resourceId) {
        return this.startCompanionRequest((requestId) => (0, Codec_1.encodeCompanionResourceInfoRequest)(requestId, resourceId), false);
    }
    // Reads bytes [start, stopInclusive] of a resource. Resolves with the bytes the sender returned
    // (fewer at the end of the resource), or null if the resource doesn't exist.
    companionRead(resourceId, start, stopInclusive) {
        return this.startCompanionRequest((requestId) => (0, Codec_1.encodeCompanionResourceRequest)(requestId, resourceId, start, stopInclusive), true);
    }
    handleResourcePacket(body, origin) {
        let part;
        try {
            part = (0, Codec_1.parseResourcePacket)(body);
        }
        catch (e) {
            logger.warn(`Session ${this.sessionId}: malformed Resource packet`, e);
            this.sendV4Error(Codec_1.ErrorKind.MalformedBody, origin.packetNumber);
            return;
        }
        const request = this.companionRequests.get(part.requestId);
        if (!request || !request.parts) {
            logger.warn(`Session ${this.sessionId}: Resource for unknown request ${part.requestId}`);
            return;
        }
        if (!part.found) {
            this.takeCompanionRequest(part.requestId).resolve(null);
            return;
        }
        // The body is a view of the receive buffer, which the next packet overwrites.
        request.parts[part.part] = Buffer.from(part.data);
        const received = request.parts.filter((p) => p !== undefined).length;
        if (received >= Math.max(1, part.totalParts)) {
            this.takeCompanionRequest(part.requestId).resolve(Buffer.concat(request.parts));
        }
    }
    // ---- v4: translating v2/v3 updates ---------------------------------------------------------
    // Translates the v2/v3 messages the rest of the receiver sends into v4 ones. Messages without
    // a v4 equivalent are dropped: after the upgrade a v4 sender rejects any other opcode. Loads,
    // queue changes and errors for v4 senders are sent explicitly, see ListenerService.sendV4.
    sendV4(opcode, message) {
        switch (opcode) {
            case Packets_1.Opcode.Ping:
            case Packets_1.Opcode.Pong:
                this.writePacket(opcode, Buffer.alloc(0));
                break;
            case Packets_1.Opcode.PlaybackUpdate:
                this.sendV4PlaybackUpdate(message);
                break;
            case Packets_1.Opcode.VolumeUpdate:
                this.sendV4Message((0, Codec_1.encodeVolumeChanged)(message.volume));
                break;
            default:
                break;
        }
    }
    sendV4PlaybackUpdate(update) {
        let state = (0, Codec_1.playbackStateToV4)(update.state);
        const now = Date.now();
        // An item that ended stays Ended (sent separately) until something else happens.
        if (state === Codec_1.V4PlaybackState.Idle && this.lastState === Codec_1.V4PlaybackState.Ended) {
            state = Codec_1.V4PlaybackState.Ended;
        }
        if (update.time !== null && update.time !== undefined) {
            // Progress goes out right away when the state changes or the position jumps (a seek);
            // while playing, the progress timer sends it at the requested interval.
            const speed = update.speed !== null && update.speed !== undefined ? update.speed : 1;
            const expected = this.lastProgressTime === null ? null :
                this.lastProgressTime + (this.lastState === Codec_1.V4PlaybackState.Playing ? (now - this.lastProgressSentAt) / 1000 * speed : 0);
            const jumped = expected === null || Math.abs(update.time - expected) > 1;
            this.lastUpdate = update;
            this.lastUpdateAt = now;
            if (state !== this.lastState || jumped) {
                this.lastProgressTime = update.time;
                this.lastProgressSentAt = now;
                this.sendV4Message((0, Codec_1.encodeProgressChanged)(update.time, update.duration));
            }
        }
        else {
            this.lastUpdate = null;
        }
        if (state !== this.lastState) {
            this.lastState = state;
            this.sendV4Message((0, Codec_1.encodePlaybackStateChanged)(state));
        }
        this.updateProgressTimer();
        if (update.speed !== null && update.speed !== undefined && update.speed !== this.lastSpeed) {
            this.lastSpeed = update.speed;
            this.sendV4Message((0, Codec_1.encodeSpeedChanged)(update.speed));
        }
    }
    stopProgressTimer() {
        if (this.progressTimer !== null) {
            clearInterval(this.progressTimer);
            this.progressTimer = null;
        }
    }
    // Runs while playing, at the sender's progress interval.
    updateProgressTimer() {
        if (!this.isV4 || this.lastState !== Codec_1.V4PlaybackState.Playing || this.lastUpdate === null) {
            this.stopProgressTimer();
            return;
        }
        if (this.progressTimer !== null && this.progressTimerMs === this.progressIntervalMs) {
            return;
        }
        this.stopProgressTimer();
        this.progressTimerMs = this.progressIntervalMs;
        this.progressTimer = setInterval(() => this.sendExtrapolatedProgress(), this.progressIntervalMs);
    }
    sendExtrapolatedProgress() {
        const update = this.lastUpdate;
        if (update === null || this.lastState !== Codec_1.V4PlaybackState.Playing) {
            this.updateProgressTimer();
            return;
        }
        const now = Date.now();
        const speed = update.speed !== null && update.speed !== undefined ? update.speed : 1;
        let position = update.time + (now - this.lastUpdateAt) / 1000 * speed;
        if (update.duration !== null && update.duration !== undefined && isFinite(update.duration) && update.duration > 0) {
            position = Math.min(position, update.duration);
        }
        this.lastProgressTime = position;
        this.lastProgressSentAt = now;
        this.sendV4Message((0, Codec_1.encodeProgressChanged)(position, update.duration));
    }
    bindEvents(emitter) {
        const forward = (event) => this.emitter.on(event, (...args) => { emitter.emit(event, ...args); });
        ["play", "pause", "resume", "stop", "seek", "setvolume", "setspeed", "version", "initial", "setplaylistitem",
            "queueselect", "queueinsert", "queueremove", "changetrack", "addsubtitle", "mirroringstart", "mirroringoffer",
            "companionhello"].forEach(forward);
        this.emitter.on("ping", () => { emitter.emit("ping", this.sessionId); });
        this.emitter.on("pong", () => { emitter.emit("pong", this.sessionId); });
        this.emitter.on("subscribeevent", (body) => { emitter.emit("subscribeevent", { sessionId: this.sessionId, body: body }); });
        this.emitter.on("unsubscribeevent", (body) => { emitter.emit("unsubscribeevent", { sessionId: this.sessionId, body: body }); });
    }
    isSupportedOpcode(opcode) {
        switch (this.protocolVersion) {
            case 1:
                return opcode <= 8;
            case 2:
                return opcode <= 13;
            case 3:
                return opcode <= 19;
            default:
                return false;
        }
    }
    stripUnsupportedFields(opcode, message = null) {
        // The same message object is sent to every session, so strip a copy.
        message = message ? Object.assign({}, message) : message;
        switch (this.protocolVersion) {
            case 1: {
                switch (opcode) {
                    case Packets_1.Opcode.Play:
                        delete message.speed;
                        delete message.headers;
                        break;
                    case Packets_1.Opcode.PlaybackUpdate:
                        delete message.generationTime;
                        delete message.duration;
                        delete message.speed;
                        message.time = message.time !== null ? message.time : 0;
                        break;
                    case Packets_1.Opcode.VolumeUpdate:
                        delete message.generationTime;
                        break;
                    default:
                        break;
                }
                // fallthrough
            }
            case 2: {
                switch (opcode) {
                    case Packets_1.Opcode.Play:
                        delete message.volume;
                        delete message.metadata;
                        break;
                    case Packets_1.Opcode.PlaybackUpdate:
                        delete message.itemIndex;
                        message.time = message.time !== null ? message.time : 0;
                        message.duration = message.duration !== null ? message.duration : 0;
                        message.speed = message.speed !== null ? message.speed : 1;
                        break;
                    default:
                        break;
                }
                // fallthrough
            }
            case 3:
                break;
            default:
                break;
        }
        return message;
    }
}
exports.FCastSession = FCastSession;


/***/ }),

/***/ 9278:
/***/ ((module) => {

"use strict";
module.exports = require("net");

/***/ }),

/***/ 9300:
/***/ (function(__unused_webpack_module, exports, __webpack_require__) {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.GenericMetaInt = void 0;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const flatbuffers = __importStar(__webpack_require__(8706));
class GenericMetaInt {
    constructor() {
        this.bb = null;
        this.bb_pos = 0;
    }
    __init(i, bb) {
        this.bb_pos = i;
        this.bb = bb;
        return this;
    }
    static getRootAsGenericMetaInt(bb, obj) {
        return (obj || new GenericMetaInt()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    static getSizePrefixedRootAsGenericMetaInt(bb, obj) {
        bb.setPosition(bb.position() + flatbuffers.SIZE_PREFIX_LENGTH);
        return (obj || new GenericMetaInt()).__init(bb.readInt32(bb.position()) + bb.position(), bb);
    }
    value() {
        const offset = this.bb.__offset(this.bb_pos, 4);
        return offset ? this.bb.readInt64(this.bb_pos + offset) : BigInt('0');
    }
    static startGenericMetaInt(builder) {
        builder.startObject(1);
    }
    static addValue(builder, value) {
        builder.addFieldInt64(0, value, BigInt('0'));
    }
    static endGenericMetaInt(builder) {
        const offset = builder.endObject();
        return offset;
    }
    static createGenericMetaInt(builder, value) {
        GenericMetaInt.startGenericMetaInt(builder);
        GenericMetaInt.addValue(builder, value);
        return GenericMetaInt.endGenericMetaInt(builder);
    }
}
exports.GenericMetaInt = GenericMetaInt;


/***/ }),

/***/ 9344:
/***/ ((module) => {

"use strict";

module.exports = (flag, argv = process.argv) => {
    const prefix = flag.startsWith('-') ? '' : (flag.length === 1 ? '-' : '--');
    const position = argv.indexOf(prefix + flag);
    const terminatorPosition = argv.indexOf('--');
    return position !== -1 && (terminatorPosition === -1 || position < terminatorPosition);
};


/***/ }),

/***/ 9608:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

// The whole point behind this internal module is to allow Node.js to no
// longer be forced to treat every error message change as a semver-major
// change. The NodeError classes here all expose a `code` property whose
// value statically and permanently identifies the error. While the error
// message may change, the code should not.
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.AssertionError = exports.RangeError = exports.TypeError = exports.Error = void 0;
exports.message = message;
exports.E = E;
const assert = __webpack_require__(2613);
const util = __webpack_require__(9023);
const kCode = typeof Symbol === 'undefined' ? '_kCode' : Symbol('code');
const messages = {}; // new Map();
function makeNodeError(Base) {
    return class NodeError extends Base {
        constructor(key, ...args) {
            super(message(key, args));
            this.code = key;
            this[kCode] = key;
            this.name = `${super.name} [${this[kCode]}]`;
        }
    };
}
const g = typeof globalThis !== 'undefined' ? globalThis : __webpack_require__.g;
class AssertionError extends g.Error {
    constructor(options) {
        if (typeof options !== 'object' || options === null) {
            throw new exports.TypeError('ERR_INVALID_ARG_TYPE', 'options', 'object');
        }
        if (options.message) {
            super(options.message);
        }
        else {
            super(`${util.inspect(options.actual).slice(0, 128)} ` +
                `${options.operator} ${util.inspect(options.expected).slice(0, 128)}`);
        }
        this.generatedMessage = !options.message;
        this.name = 'AssertionError [ERR_ASSERTION]';
        this.code = 'ERR_ASSERTION';
        this.actual = options.actual;
        this.expected = options.expected;
        this.operator = options.operator;
        exports.Error.captureStackTrace(this, options.stackStartFunction);
    }
}
exports.AssertionError = AssertionError;
function message(key, args) {
    assert.strictEqual(typeof key, 'string');
    // const msg = messages.get(key);
    const msg = messages[key];
    assert(msg, `An invalid error message key was used: ${key}.`);
    let fmt;
    if (typeof msg === 'function') {
        fmt = msg;
    }
    else {
        fmt = util.format;
        if (args === undefined || args.length === 0)
            return msg;
        args.unshift(msg);
    }
    return String(fmt.apply(null, args));
}
// Utility function for registering the error codes. Only used here. Exported
// *only* to allow for testing.
function E(sym, val) {
    messages[sym] = typeof val === 'function' ? val : String(val);
}
exports.Error = makeNodeError(g.Error);
exports.TypeError = makeNodeError(g.TypeError);
exports.RangeError = makeNodeError(g.RangeError);
// To declare an error message, use the E(sym, val) function above. The sym
// must be an upper case string. The val can be either a function or a string.
// The return value of the function must be a string.
// Examples:
// E('EXAMPLE_KEY1', 'This is the error value');
// E('EXAMPLE_KEY2', (a, b) => return `${a} ${b}`);
//
// Once an error code has been assigned, the code itself MUST NOT change and
// any given error code must never be reused to identify a different error.
//
// Any error code added here should also be added to the documentation
//
// Note: Please try to keep these in alphabetical order
E('ERR_ARG_NOT_ITERABLE', '%s must be iterable');
E('ERR_ASSERTION', '%s');
E('ERR_BUFFER_OUT_OF_BOUNDS', bufferOutOfBounds);
E('ERR_CHILD_CLOSED_BEFORE_REPLY', 'Child closed before reply received');
E('ERR_CONSOLE_WRITABLE_STREAM', 'Console expects a writable stream instance for %s');
E('ERR_CPU_USAGE', 'Unable to obtain cpu usage %s');
E('ERR_DNS_SET_SERVERS_FAILED', (err, servers) => `c-ares failed to set servers: "${err}" [${servers}]`);
E('ERR_FALSY_VALUE_REJECTION', 'Promise was rejected with falsy value');
E('ERR_ENCODING_NOT_SUPPORTED', enc => `The "${enc}" encoding is not supported`);
E('ERR_ENCODING_INVALID_ENCODED_DATA', enc => `The encoded data was not valid for encoding ${enc}`);
E('ERR_HTTP_HEADERS_SENT', 'Cannot render headers after they are sent to the client');
E('ERR_HTTP_INVALID_STATUS_CODE', 'Invalid status code: %s');
E('ERR_HTTP_TRAILER_INVALID', 'Trailers are invalid with this transfer encoding');
E('ERR_INDEX_OUT_OF_RANGE', 'Index out of range');
E('ERR_INVALID_ARG_TYPE', invalidArgType);
E('ERR_INVALID_ARRAY_LENGTH', (name, len, actual) => {
    assert.strictEqual(typeof actual, 'number');
    return `The array "${name}" (length ${actual}) must be of length ${len}.`;
});
E('ERR_INVALID_BUFFER_SIZE', 'Buffer size must be a multiple of %s');
E('ERR_INVALID_CALLBACK', 'Callback must be a function');
E('ERR_INVALID_CHAR', 'Invalid character in %s');
E('ERR_INVALID_CURSOR_POS', 'Cannot set cursor row without setting its column');
E('ERR_INVALID_FD', '"fd" must be a positive integer: %s');
E('ERR_INVALID_FILE_URL_HOST', 'File URL host must be "localhost" or empty on %s');
E('ERR_INVALID_FILE_URL_PATH', 'File URL path %s');
E('ERR_INVALID_HANDLE_TYPE', 'This handle type cannot be sent');
E('ERR_INVALID_IP_ADDRESS', 'Invalid IP address: %s');
E('ERR_INVALID_OPT_VALUE', (name, value) => {
    return `The value "${String(value)}" is invalid for option "${name}"`;
});
E('ERR_INVALID_OPT_VALUE_ENCODING', value => `The value "${String(value)}" is invalid for option "encoding"`);
E('ERR_INVALID_REPL_EVAL_CONFIG', 'Cannot specify both "breakEvalOnSigint" and "eval" for REPL');
E('ERR_INVALID_SYNC_FORK_INPUT', 'Asynchronous forks do not support Buffer, Uint8Array or string input: %s');
E('ERR_INVALID_THIS', 'Value of "this" must be of type %s');
E('ERR_INVALID_TUPLE', '%s must be an iterable %s tuple');
E('ERR_INVALID_URL', 'Invalid URL: %s');
E('ERR_INVALID_URL_SCHEME', expected => `The URL must be ${oneOf(expected, 'scheme')}`);
E('ERR_IPC_CHANNEL_CLOSED', 'Channel closed');
E('ERR_IPC_DISCONNECTED', 'IPC channel is already disconnected');
E('ERR_IPC_ONE_PIPE', 'Child process can have only one IPC pipe');
E('ERR_IPC_SYNC_FORK', 'IPC cannot be used with synchronous forks');
E('ERR_MISSING_ARGS', missingArgs);
E('ERR_MULTIPLE_CALLBACK', 'Callback called multiple times');
E('ERR_NAPI_CONS_FUNCTION', 'Constructor must be a function');
E('ERR_NAPI_CONS_PROTOTYPE_OBJECT', 'Constructor.prototype must be an object');
E('ERR_NO_CRYPTO', 'Node.js is not compiled with OpenSSL crypto support');
E('ERR_NO_LONGER_SUPPORTED', '%s is no longer supported');
E('ERR_PARSE_HISTORY_DATA', 'Could not parse history data in %s');
E('ERR_SOCKET_ALREADY_BOUND', 'Socket is already bound');
E('ERR_SOCKET_BAD_PORT', 'Port should be > 0 and < 65536');
E('ERR_SOCKET_BAD_TYPE', 'Bad socket type specified. Valid types are: udp4, udp6');
E('ERR_SOCKET_CANNOT_SEND', 'Unable to send data');
E('ERR_SOCKET_CLOSED', 'Socket is closed');
E('ERR_SOCKET_DGRAM_NOT_RUNNING', 'Not running');
E('ERR_STDERR_CLOSE', 'process.stderr cannot be closed');
E('ERR_STDOUT_CLOSE', 'process.stdout cannot be closed');
E('ERR_STREAM_WRAP', 'Stream has StringDecoder set or is in objectMode');
E('ERR_TLS_CERT_ALTNAME_INVALID', "Hostname/IP does not match certificate's altnames: %s");
E('ERR_TLS_DH_PARAM_SIZE', size => `DH parameter size ${size} is less than 2048`);
E('ERR_TLS_HANDSHAKE_TIMEOUT', 'TLS handshake timeout');
E('ERR_TLS_RENEGOTIATION_FAILED', 'Failed to renegotiate');
E('ERR_TLS_REQUIRED_SERVER_NAME', '"servername" is required parameter for Server.addContext');
E('ERR_TLS_SESSION_ATTACK', 'TSL session renegotiation attack detected');
E('ERR_TRANSFORM_ALREADY_TRANSFORMING', 'Calling transform done when still transforming');
E('ERR_TRANSFORM_WITH_LENGTH_0', 'Calling transform done when writableState.length != 0');
E('ERR_UNKNOWN_ENCODING', 'Unknown encoding: %s');
E('ERR_UNKNOWN_SIGNAL', 'Unknown signal: %s');
E('ERR_UNKNOWN_STDIN_TYPE', 'Unknown stdin file type');
E('ERR_UNKNOWN_STREAM_TYPE', 'Unknown stream file type');
E('ERR_V8BREAKITERATOR', 'Full ICU data not installed. ' + 'See https://github.com/nodejs/node/wiki/Intl');
function invalidArgType(name, expected, actual) {
    assert(name, 'name is required');
    // determiner: 'must be' or 'must not be'
    let determiner;
    if (expected.includes('not ')) {
        determiner = 'must not be';
        expected = expected.split('not ')[1];
    }
    else {
        determiner = 'must be';
    }
    let msg;
    if (Array.isArray(name)) {
        const names = name.map(val => `"${val}"`).join(', ');
        msg = `The ${names} arguments ${determiner} ${oneOf(expected, 'type')}`;
    }
    else if (name.includes(' argument')) {
        // for the case like 'first argument'
        msg = `The ${name} ${determiner} ${oneOf(expected, 'type')}`;
    }
    else {
        const type = name.includes('.') ? 'property' : 'argument';
        msg = `The "${name}" ${type} ${determiner} ${oneOf(expected, 'type')}`;
    }
    // if actual value received, output it
    if (arguments.length >= 3) {
        msg += `. Received type ${actual !== null ? typeof actual : 'null'}`;
    }
    return msg;
}
function missingArgs(...args) {
    assert(args.length > 0, 'At least one arg needs to be specified');
    let msg = 'The ';
    const len = args.length;
    args = args.map(a => `"${a}"`);
    switch (len) {
        case 1:
            msg += `${args[0]} argument`;
            break;
        case 2:
            msg += `${args[0]} and ${args[1]} arguments`;
            break;
        default:
            msg += args.slice(0, len - 1).join(', ');
            msg += `, and ${args[len - 1]} arguments`;
            break;
    }
    return `${msg} must be specified`;
}
function oneOf(expected, thing) {
    assert(expected, 'expected is required');
    assert(typeof thing === 'string', 'thing is required');
    if (Array.isArray(expected)) {
        const len = expected.length;
        assert(len > 0, 'At least one expected value needs to be specified');
        // tslint:disable-next-line
        expected = expected.map(i => String(i));
        if (len > 2) {
            return `one of ${thing} ${expected.slice(0, len - 1).join(', ')}, or ` + expected[len - 1];
        }
        else if (len === 2) {
            return `one of ${thing} ${expected[0]} or ${expected[1]}`;
        }
        else {
            return `of ${thing} ${expected[0]}`;
        }
    }
    else {
        return `of ${thing} ${String(expected)}`;
    }
}
function bufferOutOfBounds(name, isWriting) {
    if (isWriting) {
        return 'Attempt to write outside buffer bounds';
    }
    else {
        return `"${name}" is outside of buffer bounds`;
    }
}


/***/ }),

/***/ 9659:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

// automatically generated by the FlatBuffers compiler, do not modify
Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.MediaSource = void 0;
exports.unionToMediaSource = unionToMediaSource;
exports.unionListToMediaSource = unionListToMediaSource;
/* eslint-disable @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion */
const media_item_1 = __webpack_require__(2561);
const queue_1 = __webpack_require__(74);
var MediaSource;
(function (MediaSource) {
    MediaSource[MediaSource["NONE"] = 0] = "NONE";
    MediaSource[MediaSource["Single"] = 1] = "Single";
    MediaSource[MediaSource["Queue"] = 2] = "Queue";
})(MediaSource || (exports.MediaSource = MediaSource = {}));
function unionToMediaSource(type, accessor) {
    switch (MediaSource[type]) {
        case 'NONE': return null;
        case 'Single': return accessor(new media_item_1.MediaItem());
        case 'Queue': return accessor(new queue_1.Queue());
        default: return null;
    }
}
function unionListToMediaSource(type, accessor, index) {
    switch (MediaSource[type]) {
        case 'NONE': return null;
        case 'Single': return accessor(index, new media_item_1.MediaItem());
        case 'Queue': return accessor(index, new queue_1.Queue());
        default: return null;
    }
}


/***/ }),

/***/ 9896:
/***/ ((module) => {

"use strict";
module.exports = require("fs");

/***/ }),

/***/ 9897:
/***/ ((__unused_webpack_module, exports, __webpack_require__) => {

"use strict";

Object.defineProperty(exports, "__esModule", ({ value: true }));
exports.bufferFrom = exports.bufferAllocUnsafe = exports.Buffer = void 0;
const buffer_1 = __webpack_require__(181);
Object.defineProperty(exports, "Buffer", ({ enumerable: true, get: function () { return buffer_1.Buffer; } }));
function bufferV0P12Ponyfill(arg0, ...args) {
    return new buffer_1.Buffer(arg0, ...args);
}
const bufferAllocUnsafe = buffer_1.Buffer.allocUnsafe || bufferV0P12Ponyfill;
exports.bufferAllocUnsafe = bufferAllocUnsafe;
const bufferFrom = buffer_1.Buffer.from || bufferV0P12Ponyfill;
exports.bufferFrom = bufferFrom;


/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId].call(module.exports, module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/compat get default export */
/******/ 	(() => {
/******/ 		// getDefaultExport function for compatibility with non-harmony modules
/******/ 		__webpack_require__.n = (module) => {
/******/ 			var getter = module && module.__esModule ?
/******/ 				() => (module['default']) :
/******/ 				() => (module);
/******/ 			__webpack_require__.d(getter, { a: getter });
/******/ 			return getter;
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/global */
/******/ 	(() => {
/******/ 		__webpack_require__.g = (function() {
/******/ 			if (typeof globalThis === 'object') return globalThis;
/******/ 			try {
/******/ 				return this || new Function('return this')();
/******/ 			} catch (e) {
/******/ 				if (typeof window === 'object') return window;
/******/ 			}
/******/ 		})();
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
var __webpack_exports__ = {};
// This entry needs to be wrapped in an IIFE because it needs to be in strict mode.
(() => {
"use strict";
var exports = __webpack_exports__;
var __webpack_unused_export__;

__webpack_unused_export__ = ({ value: true });
// Entry point of the service bundle (dist/service/service.js). TizenBrew evaluates the bundle in a
// sandbox of its own Node service, so failures are logged rather than thrown: an uncaught error
// here would take TizenBrew's service down with it.
const Main_1 = __webpack_require__(1759);
Main_1.Main.start().catch((e) => console.error('BrewCast service failed to start:', e));

})();

/******/ })()
;