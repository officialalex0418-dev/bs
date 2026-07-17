import { Complaint, User, ComplaintMessage, Company } from '../models/index.js';
import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { notify } from '../services/notification.service.js';

/**
 * @desc    Submit a new complaint
 * @route   POST /api/v1/complaints
 * @access  Private
 */
export const createComplaint = asyncHandler(async (req, res) => {
  const { recipientId, subject, message, isGroup, attachments, type, participants } = req.body;

  // Get company package for retention days
  const company = await Company.findById(req.user.company).populate('package');
  const retentionDays = company?.package?.chatRetentionDays || 30;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + retentionDays);

  const complaintData = {
    sender: req.user._id,
    company: req.user.company,
    type: type || 'CHAT',
    subject: subject || (type === 'CHAT' ? 'Direct Message' : 'No Subject'),
    message,
    isGroup: isGroup !== false,
    participants: participants || [],
    expiresAt,
    attachments: attachments || [],
  };

  if (!complaintData.isGroup && recipientId) {
    complaintData.recipient = recipientId;
    // For private chats, sender and recipient are implicit participants
    complaintData.participants = [req.user._id, recipientId];
  } else if (complaintData.isGroup && (!participants || participants.length === 0)) {
    // If it's a "Company Group" (default group), we can leave participants empty to signify everyone.
    // Or add the sender.
    complaintData.participants = [req.user._id];
  } else if (participants && participants.length > 0) {
    // Custom group: ensure sender is included
    if (!complaintData.participants.includes(req.user._id)) {
      complaintData.participants.push(req.user._id);
    }
  }

  if (!complaintData.isGroup && recipientId) {
    complaintData.recipient = recipientId;
  }

  const complaint = await Complaint.create(complaintData);

  // Initial message
  await ComplaintMessage.create({
    complaint: complaint._id,
    sender: req.user._id,
    message,
    expiresAt,
    attachments: attachments || [],
  });

  // Update last message info
  complaint.lastMessage = message ? message.substring(0, 497) + (message.length > 497 ? '...' : '') : 'Sent an attachment';
  complaint.lastMessageAt = new Date();
  complaint.lastMessageSender = req.user._id;
  await complaint.save();

  // Create notifications
  if (complaint.isGroup) {
    // Notify all company managers/owners
    const admins = await User.find({
      company: req.user.company,
      role: { $in: ['COMPANY_OWNER', 'COMPANY_MANAGER'] },
      _id: { $ne: req.user._id }
    });

    for (const admin of admins) {
      await notify({
        recipient: admin._id,
        company: req.user.company,
        type: 'GENERAL',
        title: 'New Group Complaint',
        message: `${req.user.name} posted: ${subject}`,
      });
    }
  } else if (complaint.recipient) {
    await notify({
      recipient: complaint.recipient,
      company: req.user.company,
      type: 'GENERAL',
      title: 'New Private Complaint',
      message: `${req.user.name} sent a complaint: ${subject}`,
    });
  }

  res.status(201).json({ success: true, data: complaint });
});

/**
 * @desc    Add a reply to a complaint
 * @route   POST /api/v1/complaints/:id/messages
 * @access  Private
 */
export const addReply = asyncHandler(async (req, res) => {
  const { message, attachments } = req.body;
  const complaint = await Complaint.findById(req.params.id);

  if (!complaint) throw ApiError.notFound('Complaint not found');

  // Refresh expiration
  const company = await Company.findById(req.user.company).populate('package');
  const retentionDays = company?.package?.chatRetentionDays || 30;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + retentionDays);

  // Check if user has access
  const isSender = complaint.sender.toString() === req.user._id.toString();
  const isRecipient = complaint.recipient?.toString() === req.user._id.toString();
  const isParticipant = complaint.participants?.some(p => p.toString() === req.user._id.toString());
  const isCompanyManager = req.user.company.toString() === complaint.company.toString() &&
                          ['COMPANY_OWNER', 'COMPANY_MANAGER'].includes(req.user.role);

  // If it's a restricted group/chat (has participants), check if user is in it.
  // If it's a "Company Group" (isGroup=true and empty participants), all managers can reply.
  const hasParticipants = complaint.participants && complaint.participants.length > 0;

  if (hasParticipants && !isParticipant && !isCompanyManager) {
    throw ApiError.forbidden('Not authorized to reply to this conversation');
  }

  if (!complaint.isGroup && !isSender && !isRecipient && !isCompanyManager) {
    throw ApiError.forbidden('Not authorized to reply to this conversation');
  }

  const reply = await ComplaintMessage.create({
    complaint: complaint._id,
    sender: req.user._id,
    message,
    expiresAt,
    attachments: attachments || [],
  });

  // Update complaint last message AND expiration
  complaint.lastMessage = message ? message.substring(0, 497) + (message.length > 497 ? '...' : '') : 'Sent an attachment';
  complaint.lastMessageAt = new Date();
  complaint.lastMessageSender = req.user._id;
  complaint.expiresAt = expiresAt;
  await complaint.save();

  // Also update expiration for all messages in this complaint to keep the thread alive
  await ComplaintMessage.updateMany({ complaint: complaint._id }, { expiresAt });

  // Notify other parties
  const participants = new Set();
  if (!complaint.isGroup) {
    participants.add(complaint.sender.toString());
    if (complaint.recipient) participants.add(complaint.recipient.toString());
  } else {
    // For group, notify sender and managers? Or everyone?
    // Let's notify sender if manager replied, and notify managers if sender replied
    if (isSender) {
      const admins = await User.find({ company: complaint.company, role: { $in: ['COMPANY_OWNER', 'COMPANY_MANAGER'] } });
      admins.forEach(a => participants.add(a._id.toString()));
    } else {
      participants.add(complaint.sender.toString());
    }
  }

  participants.delete(req.user._id.toString());

  for (const pid of participants) {
    const notifyMsg = message
      ? `${req.user.name}: ${message.substring(0, 50)}${message.length > 50 ? '...' : ''}`
      : `${req.user.name} sent an attachment`;

    await notify({
      recipient: pid,
      company: complaint.company,
      type: 'GENERAL',
      title: 'New Reply on Complaint',
      message: notifyMsg,
    });
  }

  res.status(201).json({ success: true, data: reply });
});

/**
 * @desc    Get messages for a complaint
 * @route   GET /api/v1/complaints/:id/messages
 * @access  Private
 */
export const getComplaintMessages = asyncHandler(async (req, res) => {
  const messages = await ComplaintMessage.find({ complaint: req.params.id })
    .populate('sender', 'name profilePhoto role')
    .sort('createdAt');

  res.status(200).json({ success: true, data: messages });
});

/**
 * @desc    Get complaints for current user/company
 * @route   GET /api/v1/complaints
 * @access  Private
 */
export const getComplaints = asyncHandler(async (req, res) => {
  // Logic:
  // 1. If user is Owner/Manager, they see:
  //    - All Company Groups (isGroup: true, participants: empty)
  //    - Any conversation they are a participant in.
  // 2. Regular staff sees:
  //    - All Company Groups (isGroup: true, participants: empty)
  //    - Any conversation they are a participant in.

  const filter = {
    company: req.user.company,
    $or: [
      { isGroup: true, participants: { $size: 0 } }, // Public Company Groups
      { participants: req.user._id },                // Specifically added as participant
      { sender: req.user._id },                      // Own started chats
      { recipient: req.user._id }                    // Private recipient
    ]
  };

  const complaints = await Complaint.find(filter)
    .populate('sender', 'name email position')
    .populate('recipient', 'name email position')
    .populate('lastMessageSender', 'name')
    .sort('-lastMessageAt');

  res.status(200).json({ success: true, count: complaints.length, data: complaints });
});

/**
 * @desc    Get company users for recipient selection
 * @route   GET /api/v1/complaints/recipients
 * @access  Private
 */
export const getRecipients = asyncHandler(async (req, res) => {
  const users = await User.find({
    company: req.user.company,
    _id: { $ne: req.user._id },
    isActive: true,
  }).select('name position role');

  res.status(200).json({ success: true, data: users });
});
