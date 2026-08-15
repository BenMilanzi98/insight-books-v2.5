"use client";
import { tt } from '@/lib/i18n/runtime';
import React, { useState, useRef } from 'react';
import { Upload, X, Paperclip, Image, FileText, Download, Bold, Italic, Underline, List, AlignLeft, AlignCenter, AlignRight } from 'lucide-react';

const SimpleEmailComposer = ({ 
  subject, 
  setSubject, 
  message, 
  setMessage, 
  attachments, 
  setAttachments,
  onSend,
  isSending = false 
}) => {
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const handleFileUpload = (files) => {
    const newAttachments = Array.from(files).map(file => ({
      id: Date.now() + Math.random(),
      file,
      name: file.name,
      size: file.size,
      type: file.type,
      url: URL.createObjectURL(file)
    }));
    setAttachments([...attachments, ...newAttachments]);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload(files);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const removeAttachment = (id) => {
    setAttachments(attachments.filter(att => att.id !== id));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (type) => {
    if (type.startsWith('image/')) return <Image className="h-4 w-4" />;
    if (type.includes('pdf')) return <FileText className="h-4 w-4" />;
    return <Paperclip className="h-4 w-4" />;
  };

  const insertFormatting = (format) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.substring(start, end);
    let newText = '';

    switch (format) {
      case 'bold':
        newText = `**${selectedText}**`;
        break;
      case 'italic':
        newText = `*${selectedText}*`;
        break;
      case 'underline':
        newText = `<u>${selectedText}</u>`;
        break;
      case 'list':
        newText = `• ${selectedText}`;
        break;
      default:
        newText = selectedText;
    }

    const newMessage = message.substring(0, start) + newText + message.substring(end);
    setMessage(newMessage);

    // Restore cursor position
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + newText.length, start + newText.length);
    }, 0);
  };

  return (
    <div className="space-y-6">
      {/* Subject Field */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {tt('Subject *')}
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder={tt('Enter email subject...')}
          required
        />
      </div>

      {/* Simple Rich Text Editor */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {tt('Message *')}
        </label>
        
        {/* Formatting Toolbar */}
        <div className="border border-gray-300 border-b-0 rounded-t-md bg-gray-50 p-2 flex items-center space-x-2">
          <button
            type="button"
            onClick={() => insertFormatting('bold')}
            className="p-2 hover:bg-gray-200 rounded-md transition-colors"
            title="Bold"
          >
            <Bold className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('italic')}
            className="p-2 hover:bg-gray-200 rounded-md transition-colors"
            title="Italic"
          >
            <Italic className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => insertFormatting('underline')}
            className="p-2 hover:bg-gray-200 rounded-md transition-colors"
            title="Underline"
          >
            <Underline className="h-4 w-4" />
          </button>
          <div className="w-px h-6 bg-gray-300 mx-2"></div>
          <button
            type="button"
            onClick={() => insertFormatting('list')}
            className="p-2 hover:bg-gray-200 rounded-md transition-colors"
            title="Bullet List"
          >
            <List className="h-4 w-4" />
          </button>
          <div className="w-px h-6 bg-gray-300 mx-2"></div>
          <div className="text-xs text-gray-500">
            {tt('Supports: **bold**, *italic*,')} <u>{tt('underline')}</u>, • lists
          </div>
        </div>

        {/* Text Area */}
        <textarea
          ref={textareaRef}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          rows={12}
          className="w-full px-3 py-2 border border-gray-300 rounded-b-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
          placeholder={tt('Compose your message here... Use the toolbar above for basic formatting.')}
        />
      </div>

      {/* File Attachments */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {tt('Attachments')}
        </label>
        
        {/* Upload Area */}
        <div
          className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
            dragOver 
              ? 'border-blue-400 bg-blue-50' 
              : 'border-gray-300 hover:border-gray-400'
          }`}
          onDrop={handleDrop}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
        >
          <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
          <p className="text-sm text-gray-600 mb-2">
            {tt('Drag and drop files here, or click to select')}
          </p>
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="text-blue-600 hover:text-blue-700 text-sm font-medium"
          >
            {tt('Choose Files')}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            onChange={(e) => handleFileUpload(e.target.files)}
            className="hidden"
            accept="*/*"
          />
        </div>

        {/* Attachments List */}
        {attachments.length > 0 && (
          <div className="mt-4 space-y-2">
            <h4 className="text-sm font-medium text-gray-700">{tt('Attached Files:')}</h4>
            {attachments.map((attachment) => (
              <div
                key={attachment.id}
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center space-x-3">
                  {getFileIcon(attachment.type)}
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {attachment.name}
                    </p>
                    <p className="text-xs text-gray-500">
                      {formatFileSize(attachment.size)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-2">
                  <a
                    href={attachment.url}
                    download={attachment.name}
                    className="text-blue-600 hover:text-blue-700"
                  >
                    <Download className="h-4 w-4" />
                  </a>
                  <button
                    type="button"
                    onClick={() => removeAttachment(attachment.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Send Button */}
      <div className="flex justify-end">
        <button
          onClick={onSend}
          disabled={isSending || !subject.trim() || !message.trim()}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
        >
          {isSending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>{tt('Sending...')}</span>
            </>
          ) : (
            <>
              <Paperclip className="h-4 w-4" />
              <span>{tt('Send Email')}</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default SimpleEmailComposer;
