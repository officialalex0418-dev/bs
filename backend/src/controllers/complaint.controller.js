import { Complaint, User, ComplaintMessage, Company } from '../models/index.js';
import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { notify } from '../services/notification.service.js';

/**
 * @desc    Submit a new complaint
 * @route   POST /api/v1/complaints
 */
export const createComplaint = asyncHandler(async (req, res) => {
  const { recipientId, subject, message, isGroup, attachments } = req.body;

  const company = await Company.findById(req.user.company).populate('package');
  const retentionDays = company?.package?.chatRetentionDays || 30;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + retentionDays);

  const complaintData = {
    sender: req.user._id,
    company: req.user.company,
    subject,
    message,
    isGroup: isGroup !== false,
    expiresAt,
    attachments: attachments || [],
  };

  if (!complaintData.isGroup && recipientId) {
    complaintData.recipient = recipientId;
  }

  const complaint = await Complaint.create(complaintData);

  await ComplaintMessage.create({
    complaint: complaint._id,
    sender: req.user._id,
    message,
    expiresAt,
    attachments: attachments || [],
  });

  complaint.lastMessage = message ? message.substring(0, 497) : 'Sent an attachment';
  complaint.lastMessageAt = new Date();
  complaint.lastMessageSender = req.user._id;
  await complaint.save();

  return res.status(201).json({ success: true, data: complaint });
});

/**
 * @desc    Get complaints for current user
 * @route   GET /api/v1/complaints
 */
export const getComplaints = asyncHandler(async (req, res) => {
  const filter = {
    company: req.user.company,
    $or: [
      { isGroup: true },
      { sender: req.user._id },
      { recipient: req.user._id }
    ]
  };

  const complaints = await Complaint.find(filter)
    .populate('sender', 'name position')
    .populate('recipient', 'name position')
    .populate('lastMessageSender', 'name')
    .sort('-lastMessageAt');

  res.status(200).json({ success: true, data: complaints });
});

/**
 * @desc    Get messages for a complaint
 */
export const getComplaintMessages = asyncHandler(async (req, res) => {
  const messages = await ComplaintMessage.find({ complaint: req.params.id })
    .populate('sender', 'name profilePhoto role')
    .sort('createdAt');
  res.status(200).json({ success: true, data: messages });
});

/**
 * @desc    Add a reply to a complaint
 */
export const addReply = asyncHandler(async (req, res) => {
  const { message, attachments } = req.body;
  const complaint = await Complaint.findById(req.params.id);
  if (!complaint) throw ApiError.notFound('Complaint not found');

  const company = await Company.findById(req.user.company).populate('package');
  const retentionDays = company?.package?.chatRetentionDays || 30;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + retentionDays);

  const reply = await ComplaintMessage.create({
    complaint: complaint._id,
    sender: req.user._id,
    message,
    expiresAt,
    attachments: attachments || [],
  });

  complaint.lastMessage = message ? message.substring(0, 497) : 'Sent an attachment';
  complaint.lastMessageAt = new Date();
  complaint.lastMessageSender = req.user._id;
  complaint.expiresAt = expiresAt;
  await complaint.save();

  await ComplaintMessage.updateMany({ complaint: complaint._id }, { expiresAt });

  res.status(201).json({ success: true, data: reply });
});

/**
 * @desc    Get company users for recipient selection
 */
export const getRecipients = asyncHandler(async (req, res) => {
  const users = await User.find({
    company: req.user.company,
    _id: { $ne: req.user._id },
    isActive: true,
  }).select('name position role');
  res.status(200).json({ success: true, data: users });
});
