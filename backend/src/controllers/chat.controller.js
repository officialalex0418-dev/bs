import { Chat, ChatMessage, User, Company } from '../models/index.js';
import { asyncHandler, ApiError } from '../utils/ApiError.js';
import { notify } from '../services/notification.service.js';

export const createChat = asyncHandler(async (req, res) => {
  const { recipientId, participants, groupName, message, isGroup, attachments } = req.body;

  const company = await Company.findById(req.user.company).populate('package');
  const retentionDays = company?.package?.chatRetentionDays || 30;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + retentionDays);

  const chatData = {
    sender: req.user._id,
    company: req.user.company,
    groupName: groupName || (isGroup ? 'New Group' : null),
    isGroup: isGroup === true,
    expiresAt,
  };

  if (!chatData.isGroup && recipientId) {
    chatData.recipient = recipientId;
    chatData.participants = [req.user._id, recipientId];
  } else if (chatData.isGroup) {
    chatData.participants = participants || [];
    if (!chatData.participants.includes(req.user._id.toString())) {
      chatData.participants.push(req.user._id);
    }
  } else {
      // Default company group if nothing specified
      chatData.isGroup = true;
      chatData.groupName = 'Company Group';
      chatData.participants = []; // Empty means everyone in company
  }

  const chat = await Chat.create(chatData);

  await ChatMessage.create({
    chat: chat._id,
    sender: req.user._id,
    message,
    expiresAt,
    attachments: attachments || [],
  });

  chat.lastMessage = message ? message.substring(0, 497) : 'Attachment';
  chat.lastMessageAt = new Date();
  chat.lastMessageSender = req.user._id;
  await chat.save();

  return res.status(201).json({ success: true, data: chat });
});

export const getChats = asyncHandler(async (req, res) => {
  const filter = {
    company: req.user.company,
    $or: [
      { isGroup: true, participants: { $size: 0 } },
      { participants: req.user._id },
    ]
  };

  const chats = await Chat.find(filter)
    .populate('sender', 'name position')
    .populate('recipient', 'name position')
    .populate('lastMessageSender', 'name')
    .sort('-lastMessageAt');

  res.status(200).json({ success: true, data: chats });
});

export const getChatMessages = asyncHandler(async (req, res) => {
  const messages = await ChatMessage.find({ chat: req.params.id })
    .populate('sender', 'name profilePhoto role')
    .sort('createdAt');
  res.status(200).json({ success: true, data: messages });
});

export const addChatMessage = asyncHandler(async (req, res) => {
  const { message, attachments } = req.body;
  const chat = await Chat.findById(req.params.id);
  if (!chat) throw ApiError.notFound('Chat not found');

  const company = await Company.findById(req.user.company).populate('package');
  const retentionDays = company?.package?.chatRetentionDays || 30;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + retentionDays);

  const reply = await ChatMessage.create({
    chat: chat._id,
    sender: req.user._id,
    message,
    expiresAt,
    attachments: attachments || [],
  });

  chat.lastMessage = message ? message.substring(0, 497) : 'Attachment';
  chat.lastMessageAt = new Date();
  chat.lastMessageSender = req.user._id;
  chat.expiresAt = expiresAt;
  await chat.save();

  await ChatMessage.updateMany({ chat: chat._id }, { expiresAt });

  res.status(201).json({ success: true, data: reply });
});
