const mongoose = require('mongoose');

const PartsSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  spec: {
    group: {
      type: String,
      enum: ['spatial', 'creative', 'social'],
      default: 'spatial'
    },
    type: {
      type: String,
      required: true
    },
    color: {
      type: String,
      default: null
    },
    category: {
      type: String,
      default: null
    }
  },
  sequence: {
    type: Number,
    default: 0
  },
  tracking: {
    type: Boolean,
    default: false
  },
  assetUrl: {
    type: String,
    required: false,
    default: ''
  }
}, {
  timestamps: true
});

// 이미 정의된 모델이 있으면 그것을 사용하고, 없으면 새로 생성
const Parts = mongoose.models.Parts || mongoose.model('Parts', PartsSchema);

module.exports = Parts;