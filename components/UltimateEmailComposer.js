"use client";
import { tt } from '@/lib/i18n/runtime';
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Upload, X, Paperclip, Image, FileText, Download, Send, Bold, Italic, Underline, List, AlignLeft, AlignCenter, AlignRight, Link, Quote, Type, Palette, AlignJustify } from 'lucide-react';

const UltimateEmailComposer = ({ 
  subject, 
  setSubject, 
  message, 
  setMessage, 
  attachments, 
  setAttachments,
  onSend,
  isSending = false,
  priority = 'normal',
  setPriority,
  showPriority = false,
  setShowPriority,
  selectedTemplate = 'custom',
  setSelectedTemplate
}) => {
  const [dragOver, setDragOver] = useState(false);
  const [showImageUpload, setShowImageUpload] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedColor, setSelectedColor] = useState('#000000');
  const [fontSize, setFontSize] = useState('14px');
  const [fontFamily, setFontFamily] = useState('Arial');
  const editorRef = useRef(null);
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);

  // Initialize editor content
  useEffect(() => {
    if (editorRef.current && message) {
      editorRef.current.innerHTML = message;
    }
  }, []);

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
            
            // Insert image into editor with proper URL
            insertImage(imageUrl, file.name);
          } else {
            console.error('Failed to upload image:', response.statusText);
            // Fallback to base64
            const reader = new FileReader();
            reader.onload = (e) => {
              insertImage(e.target.result, file.name);
            };
            reader.readAsDataURL(file);
          }
        } catch (error) {
          console.error('Error uploading image:', error);
          // Fallback to base64
          const reader = new FileReader();
          reader.onload = (e) => {
            insertImage(e.target.result, file.name);
          };
          reader.readAsDataURL(file);
        }
      }
    }
    setShowImageUpload(false);
  };

  const insertImage = (src, alt) => {
    // Ensure the editor is focused
    if (editorRef.current) {
      editorRef.current.focus();
    }
    
    const img = document.createElement('img');
    img.src = src;
    img.alt = alt || 'Image';
    img.style.maxWidth = '100%';
    img.style.height = 'auto';
    img.style.borderRadius = '8px';
    img.style.boxShadow = '0 4px 6px -1px rgba(0, 0, 0, 0.1)';
    img.style.margin = '16px 0';
    img.style.display = 'block';
    img.style.marginLeft = 'auto';
    img.style.marginRight = 'auto';
    
    // Insert the image using execCommand
    document.execCommand('insertHTML', false, img.outerHTML);
    updateMessage();
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

  const updateMessage = () => {
    if (editorRef.current) {
      setMessage(editorRef.current.innerHTML);
    }
  };

  const execCommand = (command, value = null) => {
    document.execCommand(command, false, value);
    updateMessage();
    editorRef.current?.focus();
  };

  const insertFormatting = (format) => {
    switch (format) {
      case 'bold':
        execCommand('bold');
        break;
      case 'italic':
        execCommand('italic');
        break;
      case 'underline':
        execCommand('underline');
        break;
      case 'link':
        const url = prompt('Enter URL:');
        if (url) {
          execCommand('createLink', url);
        }
        break;
      case 'quote':
        execCommand('formatBlock', 'blockquote');
        break;
      case 'h1':
        execCommand('formatBlock', 'h1');
        break;
      case 'h2':
        execCommand('formatBlock', 'h2');
        break;
      case 'h3':
        execCommand('formatBlock', 'h3');
        break;
      case 'list':
        execCommand('insertUnorderedList');
        break;
      case 'alignLeft':
        execCommand('justifyLeft');
        break;
      case 'alignCenter':
        execCommand('justifyCenter');
        break;
      case 'alignRight':
        execCommand('justifyRight');
        break;
      case 'alignJustify':
        execCommand('justifyFull');
        break;
      case 'color':
        setShowColorPicker(!showColorPicker);
        break;
      case 'fontSize':
        const newSize = prompt('Enter font size (e.g., 14px, 16px):', fontSize);
        if (newSize) {
          setFontSize(newSize);
          // Apply font size to selection only
          const selection = window.getSelection();
          if (selection.rangeCount > 0 && !selection.isCollapsed) {
            const range = selection.getRangeAt(0);
            const span = document.createElement('span');
            span.style.fontSize = newSize;
            try {
              range.surroundContents(span);
            } catch (e) {
              // If surroundContents fails, insert the span
              range.insertNode(span);
            }
            updateMessage();
          }
        }
        break;
      case 'fontFamily':
        const newFont = prompt('Enter font family (e.g., Arial, Times New Roman):', fontFamily);
        if (newFont) {
          setFontFamily(newFont);
          execCommand('fontName', newFont);
        }
        break;
    }
  };

  const colors = [
    '#000000', '#333333', '#666666', '#999999', '#CCCCCC', '#FFFFFF',
    '#FF0000', '#FF6600', '#FFCC00', '#00FF00', '#0066FF', '#6600FF',
    '#FF0066', '#00CCCC', '#FFCC99', '#CCFFCC', '#CCCCFF', '#FFCCFF'
  ];

  return (
    <div className="space-y-6">
      {/* Template Selector */}
      {setSelectedTemplate && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            {tt('Email Template')}
          </label>
          <select
            value={selectedTemplate}
            onChange={(e) => setSelectedTemplate(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="custom">{tt('Custom Email')}</option>
            <option value="subscription-reminder">{tt('Subscription Reminder')}</option>
            <option value="announcement">{tt('Announcement')}</option>
            <option value="welcome">{tt('Welcome Email')}</option>
            <option value="maintenance-notice">{tt('Maintenance Notice')}</option>
            <option value="feature-update">{tt('Feature Update')}</option>
            <option value="password-reset">{tt('Password Reset')}</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">{tt('Select a template to pre-fill subject and content')}</p>
        </div>
      )}

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

      {/* Priority Section Toggle */}
      {setShowPriority && (
        <>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tt('Show Priority Badge')}
              </label>
              <p className="text-xs text-gray-500">{tt('Display a priority indicator in the email')}</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={showPriority}
                onChange={(e) => setShowPriority(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Priority Level Selector (shown when toggle is on) */}
          {showPriority && setPriority && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {tt('Priority Level')}
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="low">{tt('Low')}</option>
                <option value="normal">{tt('Normal')}</option>
                <option value="high">{tt('High')}</option>
                <option value="urgent">{tt('Urgent')}</option>
              </select>
            </div>
          )}
        </>
      )}

      {/* Professional WYSIWYG Editor */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          {tt('Message *')}
        </label>
        
        {/* Advanced Toolbar */}
        <div className="border border-gray-300 border-b-0 rounded-t-md bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1 flex-wrap">
              {/* Text Formatting */}
              <div className="flex items-center space-x-1 mr-4">
                <button
                  type="button"
                  onClick={() => insertFormatting('h1')}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors text-sm font-bold"
                  title={tt('Heading 1')}
                >
                  {tt('H1')}
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('h2')}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors text-sm font-bold"
                  title={tt('Heading 2')}
                >
                  {tt('H2')}
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('h3')}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors text-sm font-bold"
                  title={tt('Heading 3')}
                >
                  {tt('H3')}
                </button>
              </div>

              <div className="w-px h-6 bg-gray-300 mx-2"></div>

              {/* Basic Formatting */}
              <div className="flex items-center space-x-1 mr-4">
                <button
                  type="button"
                  onClick={() => insertFormatting('bold')}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors"
                  title={tt('Bold')}
                >
                  <Bold className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('italic')}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors"
                  title={tt('Italic')}
                >
                  <Italic className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('underline')}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors"
                  title={tt('Underline')}
                >
                  <Underline className="h-4 w-4" />
                </button>
              </div>

              <div className="w-px h-6 bg-gray-300 mx-2"></div>

              {/* Lists and Quotes */}
              <div className="flex items-center space-x-1 mr-4">
                <button
                  type="button"
                  onClick={() => insertFormatting('list')}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors"
                  title={tt('Bullet List')}
                >
                  <List className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('quote')}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors"
                  title={tt('Quote')}
                >
                  <Quote className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('link')}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors"
                  title={tt('Link')}
                >
                  <Link className="h-4 w-4" />
                </button>
              </div>

              <div className="w-px h-6 bg-gray-300 mx-2"></div>

              {/* Alignment */}
              <div className="flex items-center space-x-1 mr-4">
                <button
                  type="button"
                  onClick={() => insertFormatting('alignLeft')}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors"
                  title={tt('Align Left')}
                >
                  <AlignLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('alignCenter')}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors"
                  title={tt('Align Center')}
                >
                  <AlignCenter className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('alignRight')}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors"
                  title={tt('Align Right')}
                >
                  <AlignRight className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('alignJustify')}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors"
                  title={tt('Justify')}
                >
                  <AlignJustify className="h-4 w-4" />
                </button>
              </div>

              <div className="w-px h-6 bg-gray-300 mx-2"></div>

              {/* Font Controls */}
              <div className="flex items-center space-x-1 mr-4">
                <button
                  type="button"
                  onClick={() => insertFormatting('fontSize')}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors"
                  title={tt('Font Size')}
                >
                  <Type className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('fontFamily')}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors text-xs"
                  title={tt('Font Family')}
                >
                  {tt('Aa')}
                </button>
                <button
                  type="button"
                  onClick={() => insertFormatting('color')}
                  className="p-2 hover:bg-gray-200 rounded-md transition-colors"
                  title={tt('Text Color')}
                >
                  <Palette className="h-4 w-4" />
                </button>
              </div>
            </div>
            
            {/* Image Upload */}
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setShowImageUpload(true)}
                className="p-2 hover:bg-gray-200 rounded-md transition-colors text-blue-600"
                title={tt('Insert Image')}
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

          {/* Color Picker */}
          {showColorPicker && (
            <div className="mt-3 p-3 bg-white border border-gray-200 rounded-md">
              <div className="grid grid-cols-6 gap-2">
                {colors.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => {
                      setSelectedColor(color);
                      // Apply color to selection only
                      const selection = window.getSelection();
                      if (selection.rangeCount > 0 && !selection.isCollapsed) {
                        const range = selection.getRangeAt(0);
                        const span = document.createElement('span');
                        span.style.color = color;
                        try {
                          range.surroundContents(span);
                        } catch (e) {
                          // If surroundContents fails, insert the span
                          range.insertNode(span);
                        }
                        updateMessage();
                      } else {
                        // If no selection, apply to entire content
                        execCommand('foreColor', color);
                      }
                      setShowColorPicker(false);
                    }}
                    className="w-8 h-8 rounded border border-gray-300 hover:scale-110 transition-transform"
                    style={{ backgroundColor: color }}
                    title={color}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* ContentEditable Editor */}
        <div
          ref={editorRef}
          contentEditable
          onInput={updateMessage}
          onBlur={updateMessage}
          className="w-full min-h-[400px] px-4 py-3 border border-gray-300 rounded-b-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none overflow-y-auto"
          style={{
            fontFamily: fontFamily,
            fontSize: fontSize,
            lineHeight: '1.6',
            color: selectedColor
          }}
          data-placeholder={tt('Compose your professional email message here...')}
        />

        {/* Enhanced CSS for proper formatting display */}
        <style jsx>{`
          [contenteditable]:empty:before {
            content: attr(data-placeholder);
            color: #9ca3af;
            font-style: italic;
          }
          
          [contenteditable] h1 {
            font-size: 24px !important;
            font-weight: 700 !important;
            margin: 16px 0 8px 0 !important;
            line-height: 1.2 !important;
            color: #111827 !important;
            display: block !important;
          }
          
          [contenteditable] h2 {
            font-size: 20px !important;
            font-weight: 700 !important;
            margin: 20px 0 10px 0 !important;
            line-height: 1.3 !important;
            color: #111827 !important;
            display: block !important;
          }
          
          [contenteditable] h3 {
            font-size: 18px !important;
            font-weight: 600 !important;
            margin: 16px 0 8px 0 !important;
            line-height: 1.4 !important;
            color: #1f2937 !important;
            display: block !important;
          }
          
          [contenteditable] ul {
            margin: 16px 0 !important;
            padding-left: 20px !important;
            display: block !important;
          }
          
          [contenteditable] li {
            margin: 4px 0 !important;
            color: #374151 !important;
            display: list-item !important;
            list-style-type: disc !important;
          }
          
          [contenteditable] blockquote {
            border-left: 4px solid #e5e7eb !important;
            padding-left: 16px !important;
            margin: 16px 0 !important;
            color: #6b7280 !important;
            font-style: italic !important;
            display: block !important;
          }
          
          [contenteditable] strong {
            font-weight: 700 !important;
            color: #111827 !important;
          }
          
          [contenteditable] em {
            font-style: italic !important;
            color: #374151 !important;
          }
          
          [contenteditable] u {
            text-decoration: underline !important;
          }
          
          [contenteditable] img {
            max-width: 100% !important;
            height: auto !important;
            border-radius: 8px !important;
            box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1) !important;
            margin: 16px 0 !important;
            display: block !important;
            margin-left: auto !important;
            margin-right: auto !important;
          }
        `}</style>
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

export default UltimateEmailComposer;
