import React, { useState, useRef } from 'react';
import { X, Send, Mail, AlertCircle, Loader2, Paperclip, File, Image, Plus } from 'lucide-react';

const isValidEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((s || '').trim());

const SendQuotationModal = ({ isOpen, onClose, quotation, isSending, companyName, onMessageSubmit }) => {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [otherEmails, setOtherEmails] = useState([]);
  const [otherEmailInput, setOtherEmailInput] = useState('');
  const fileInputRef = useRef(null);

  const clientName = typeof quotation?.client === 'string' ? quotation.client : quotation?.client?.name;
  const clientEmail = typeof quotation?.client === 'object' ? quotation?.client?.email : null;

  const addOtherEmail = () => {
    const email = otherEmailInput.trim();
    if (!email) return;
    if (!isValidEmail(email)) {
      setOtherEmailInput('');
      return;
    }
    const normalized = email.toLowerCase();
    if (otherEmails.some((e) => e.toLowerCase() === normalized)) return;
    setOtherEmails((prev) => [...prev, email]);
    setOtherEmailInput('');
  };

  const removeOtherEmail = (index) => {
    setOtherEmails((prev) => prev.filter((_, i) => i !== index));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length) {
      setAttachments((prev) => [...prev, ...files]);
    }
    e.target.value = '';
  };

  const removeAttachment = (index) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (onMessageSubmit) {
      onMessageSubmit(message, attachments, otherEmails);
    }
    setAttachments([]);
    setOtherEmails([]);
    setOtherEmailInput('');
    onClose();
  };

  const handleClose = () => {
    setAttachments([]);
    setOtherEmails([]);
    setOtherEmailInput('');
    onClose();
  };

  if (!isOpen || !quotation) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg">
        <div className="flex justify-between items-center p-4 border-b border-gray-200">
          <h3 className="text-lg font-medium">Send Quotation to Client</h3>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600 focus:outline-none"
            onClick={handleClose}
            disabled={isSending}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="p-4">
            <div className="mb-4">
              <div className="flex items-center space-x-2 mb-4 p-3 bg-blue-50 rounded-md border border-blue-100">
                <Mail className="h-5 w-5 text-blue-500 flex-shrink-0" />
                <div>
                  <p className="font-medium text-blue-800">Quotation will be included in email</p>
                  <p className="text-sm text-blue-600">Quotation #{quotation.quotationNumber} will be attached as PDF</p>
                </div>
              </div>

              <div className="mb-4">
                <p className="text-sm text-gray-700 mb-2">
                  <strong>To:</strong> {clientName || 'Client'}{clientEmail ? ` (${clientEmail})` : ''}
                </p>
                <div className="mb-3">
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    Also send to (optional)
                  </label>
                  <div className="flex gap-2 flex-wrap">
                    <input
                      type="email"
                      className="flex-1 min-w-[180px] p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500 text-sm"
                      placeholder="email@example.com"
                      value={otherEmailInput}
                      onChange={(e) => setOtherEmailInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addOtherEmail())}
                    />
                    <button
                      type="button"
                      onClick={addOtherEmail}
                      className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Add
                    </button>
                  </div>
                  {otherEmails.length > 0 && (
                    <ul className="mt-2 flex flex-wrap gap-2">
                      {otherEmails.map((email, index) => (
                        <li
                          key={`${email}-${index}`}
                          className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 rounded text-sm text-gray-700"
                        >
                          <span>{email}</span>
                          <button
                            type="button"
                            onClick={() => removeOtherEmail(index)}
                            className="text-gray-500 hover:text-red-600 focus:outline-none"
                            aria-label={`Remove ${email}`}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <p className="text-sm text-gray-700 mb-2">
                  <strong>Subject:</strong> Quotation #{quotation.quotationNumber} from {companyName}
                </p>
              </div>

              <label className="block text-sm font-medium text-gray-700 mb-1">
                Additional Message (Optional)
              </label>
              <textarea
                className="w-full p-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                rows="5"
                placeholder="Include any additional information for your client..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Attach files (optional)
              </label>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                accept="*/*"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                <Paperclip className="h-4 w-4 mr-2 text-gray-500" />
                Add files (images, documents, etc.)
              </button>
              {attachments.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {attachments.map((file, index) => (
                    <li
                      key={`${file.name}-${index}`}
                      className="flex items-center justify-between text-sm text-gray-600 bg-gray-50 rounded px-2 py-1.5"
                    >
                      <span className="flex items-center min-w-0 truncate">
                        {file.type.startsWith('image/') ? (
                          <Image className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                        ) : (
                          <File className="h-4 w-4 mr-2 text-gray-400 flex-shrink-0" />
                        )}
                        <span className="truncate">{file.name}</span>
                        <span className="text-gray-400 ml-1 flex-shrink-0">
                          ({(file.size / 1024).toFixed(1)} KB)
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAttachment(index)}
                        className="ml-2 text-red-500 hover:text-red-700 focus:outline-none flex-shrink-0"
                        aria-label="Remove file"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {!clientEmail && (
              <div className="mb-4 flex items-start p-3 bg-amber-50 rounded-md border border-amber-100">
                <AlertCircle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5 mr-2" />
                <div>
                  <p className="font-medium text-amber-800">Client email not shown in list</p>
                  <p className="text-sm text-amber-700">Sending will use the email from the client profile. If none is set, the send will fail.</p>
                </div>
              </div>
            )}
          </div>

          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-end">
            <button
              type="button"
              className="px-4 py-2 bg-white border border-gray-300 rounded-md font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 mr-3"
              onClick={handleClose}
              disabled={isSending}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 border border-transparent rounded-md font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 inline-flex items-center"
              disabled={isSending}
            >
              {isSending ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" />
                  Sending...
                </>
              ) : (
                <>
                  <Send className="-ml-1 mr-2 h-4 w-4" />
                  Send Quotation
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default SendQuotationModal;
