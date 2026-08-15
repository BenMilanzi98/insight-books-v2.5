"use client";
import { tt } from '@/lib/i18n/runtime';
import React, { useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { Upload, X, Paperclip, Image, FileText, Download, Send, Bold, Italic, Underline, List, AlignLeft, AlignCenter, AlignRight, Link, Quote } from 'lucide-react';

// Dynamically import MDEditor to avoid SSR issues
const MDEditor = dynamic(() => import('@uiw/react-md-editor'), { ssr: false });

const ProfessionalEmailComposer = ({ 
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
  const [showImageUpload, setShowImageUpload] = useState(false);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

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

  const handleImageUpload = async (files) => {
    for (const file of files) {
      if (file.type.startsWith('image/')) {
        // Upload image to server
        const formData = new FormData();
        formData.append('file', file);
        
        try {
          const response = await fetch('/api/admin/upload-attachment', {
            method: 'POST',
            body: formData
          });
          
          if (response.ok) {
            const data = await response.json();
            const imageUrl = data.file.url;
            
            // Insert image into editor
            const imageMarkdown = `![${file.name}](${imageUrl})`;
            setMessage(prev => prev + `\n\n${imageMarkdown}\n\n`);
          }
        } catch (error) {
          console.error('Error uploading image:', error);
          // Fallback to base64
          const reader = new FileReader();
          reader.onload = (e) => {
            const imageMarkdown = `![${file.name}](${e.target.result})`;
            setMessage(prev => prev + `\n\n${imageMarkdown}\n\n`);
          };
          reader.readAsDataURL(file);
        }
      }
    }
    setShowImageUpload(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const imageFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
      const otherFiles = Array.from(files).filter(file => !file.type.startsWith('image/'));
      
      if (imageFiles.length > 0) {
        handleImageUpload(imageFiles);
      }
      if (otherFiles.length > 0) {
        handleFileUpload(otherFiles);
      }
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
    const textarea = document.querySelector('.w-md-editor-text-input');
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = message.substring(start, end);
    let newText = '';

    switch (format) {
      case 'bold':
        newText = `**${selectedText || 'bold text'}**`;
        break;
      case 'italic':
        newText = `*${selectedText || 'italic text'}*`;
        break;
      case 'underline':
        newText = `<u>${selectedText || 'underlined text'}</u>`;
        break;
      case 'link':
        newText = `[${selectedText || 'link text'}](https://example.com)`;
        break;
      case 'quote':
        newText = `> ${selectedText || 'quote text'}`;
        break;
      case 'list':
        newText = `- ${selectedText || 'list item'}`;
        break;
      case 'h1':
        newText = `# ${selectedText || 'Heading 1'}`;
        break;
      case 'h2':
        newText = `## ${selectedText || 'Heading 2'}`;
        break;
      case 'h3':
        newText = `### ${selectedText || 'Heading 3'}`;
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

      {/* Professional Rich Text Editor */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {tt('Message *')}
        </label>
        
        {/* Custom Toolbar */}
        <div className="border border-gray-300 border-b-0 rounded-t-md bg-gray-50 p-2 flex items-center justify-between">
          <div className="flex items-center space-x-1">
            <button
              type="button"
              onClick={() => insertFormatting('h1')}
              className="p-2 hover:bg-gray-200 rounded-md transition-colors text-sm font-bold"
              title="Heading 1"
            >
              {tt('H1')}
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('h2')}
              className="p-2 hover:bg-gray-200 rounded-md transition-colors text-sm font-bold"
              title="Heading 2"
            >
              {tt('H2')}
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('h3')}
              className="p-2 hover:bg-gray-200 rounded-md transition-colors text-sm font-bold"
              title="Heading 3"
            >
              {tt('H3')}
            </button>
            <div className="w-px h-6 bg-gray-300 mx-2"></div>
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
            <button
              type="button"
              onClick={() => insertFormatting('quote')}
              className="p-2 hover:bg-gray-200 rounded-md transition-colors"
              title="Quote"
            >
              <Quote className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => insertFormatting('link')}
              className="p-2 hover:bg-gray-200 rounded-md transition-colors"
              title="Link"
            >
              <Link className="h-4 w-4" />
            </button>
          </div>
          
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={() => setShowImageUpload(true)}
              className="p-2 hover:bg-gray-200 rounded-md transition-colors text-blue-600"
              title="Insert Image"
            >
              <Image className="h-4 w-4" />
            </button>
            <input
              ref={imageInputRef}
              type="file"
              multiple
              accept="image/*"
              onChange={(e) => handleImageUpload(e.target.files)}
              className="hidden"
            />
          </div>
        </div>

        {/* Markdown Editor */}
        <div className="border border-gray-300 rounded-b-md overflow-hidden">
          <MDEditor
            value={message}
            onChange={(val) => setMessage(val || '')}
            height={400}
            data-color-mode="light"
            preview="edit"
            hideToolbar={true}
            visibleDragBar={false}
            textareaProps={{
              placeholder: 'Compose your professional email message here...',
              style: {
                fontSize: 14,
                lineHeight: 1.6,
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }
            }}
          />
        </div>
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
          <p className="text-xs text-gray-500 mb-3">
            {tt('Images will be inserted inline • Other files will be attached')}
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
          className="px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2 font-medium"
        >
          {isSending ? (
            <>
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              <span>{tt('Sending...')}</span>
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              <span>{tt('Send Professional Email')}</span>
            </>
          )}
        </button>
      </div>

      {/* Image Upload Modal */}
      {showImageUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">{tt('Insert Image')}</h3>
              <button
                onClick={() => setShowImageUpload(false)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <X className="h-5 w-5 text-gray-500" />
              </button>
            </div>
            
            <div className="space-y-4">
              <p className="text-sm text-gray-600">
                {tt('Select images to insert directly into your email body.')}
              </p>
              
              <button
                onClick={() => imageInputRef.current?.click()}
                className="w-full p-4 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-400 hover:bg-blue-50 transition-colors flex items-center justify-center space-x-2"
              >
                <Image className="h-6 w-6 text-gray-400" />
                <span className="text-gray-600">{tt('Choose Images')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfessionalEmailComposer;
