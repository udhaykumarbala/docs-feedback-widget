import { render } from 'preact';
import { useState, useEffect } from 'preact/hooks';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'YOUR_SUPABASE_URL';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_SUPABASE_ANON_KEY';

// Only create client if credentials are provided
const supabase = (SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY') 
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : null;

interface Comment {
  id: string;
  telegram_name: string;
  page_url: string;
  selected_text: string;
  comment: string;
  created_at: string;
  position: { x: number; y: number };
}

interface CommentTooltip {
  show: boolean;
  x: number;
  y: number;
  comments: Comment[];
}

function FeedbackWidget() {
  const [username, setUsername] = useState<string | null>(null);
  const [showAuth, setShowAuth] = useState(false);
  const [selectedText, setSelectedText] = useState('');
  const [showCommentBox, setShowCommentBox] = useState(false);
  const [comment, setComment] = useState('');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [comments, setComments] = useState<Comment[]>([]);
  const [tooltip, setTooltip] = useState<CommentTooltip>({ show: false, x: 0, y: 0, comments: [] });

  useEffect(() => {
    const savedUsername = localStorage.getItem('feedback_telegram_name');
    if (savedUsername) {
      setUsername(savedUsername);
    } else {
      setShowAuth(true);
    }

    loadComments();
    setupSelectionHandler();
  }, []);

  const loadComments = async () => {
    if (!supabase) {
      console.warn('Feedback widget: Supabase not configured');
      return;
    }
    
    try {
      const { data, error } = await supabase
        .from('feedback_comments')
        .select('*')
        .eq('page_url', window.location.href);
      
      if (error) {
        console.error('Error loading comments:', error);
        return;
      }
      
      if (data) setComments(data);
    } catch (err) {
      console.error('Failed to load comments:', err);
    }
  };

  const setupSelectionHandler = () => {
    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('touchend', handleTextSelection);
  };

  const handleTextSelection = (e: MouseEvent | TouchEvent) => {
    // Don't hide if clicking inside the comment popup
    const target = e.target as HTMLElement;
    if (target.closest('.feedback-comment-popup')) {
      return;
    }
    
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    
    if (text && text.length > 3) {
      const range = selection!.getRangeAt(0);
      const rect = range.getBoundingClientRect();
      
      setSelectedText(text);
      setPosition({
        x: rect.left + rect.width / 2,
        y: rect.top - 10
      });
      setShowCommentBox(true);
    } else if (!text) {
      setShowCommentBox(false);
    }
  };

  const handleAuth = (e: Event) => {
    e.preventDefault();
    const input = (e.target as HTMLFormElement).telegram_name;
    const name = input.value.trim();
    
    if (name) {
      localStorage.setItem('feedback_telegram_name', name);
      setUsername(name);
      setShowAuth(false);
    }
  };

  const handleSubmitComment = async () => {
    if (!comment.trim() || !username) return;
    
    if (!supabase) {
      alert('Feedback widget not configured. Please set up Supabase credentials.');
      return;
    }

    try {
      const { error } = await supabase
        .from('feedback_comments')
        .insert({
          telegram_name: username,
          page_url: window.location.href,
          selected_text: selectedText,
          comment: comment,
          position: position
        });

      if (error) {
        console.error('Error submitting comment:', error);
        alert('Failed to submit comment. Please try again.');
        return;
      }

      setComment('');
      setShowCommentBox(false);
      // Clear selection after submitting
      window.getSelection()?.removeAllRanges();
      loadComments();
    } catch (err) {
      console.error('Failed to submit comment:', err);
      alert('Failed to submit comment. Please try again.');
    }
  };

  const highlightCommentedText = () => {
    // Group comments by selected text
    const commentsByText = comments.reduce((acc, comment) => {
      if (!acc[comment.selected_text]) {
        acc[comment.selected_text] = [];
      }
      acc[comment.selected_text].push(comment);
      return acc;
    }, {} as Record<string, Comment[]>);

    Object.entries(commentsByText).forEach(([text, textComments]) => {
      const walker = document.createTreeWalker(
        document.body,
        NodeFilter.SHOW_TEXT,
        {
          acceptNode: (node) => {
            if (node.textContent?.includes(text) && 
                !node.parentElement?.classList.contains('feedback-highlight') &&
                !node.parentElement?.closest('.feedback-comment-popup') &&
                !node.parentElement?.closest('.feedback-tooltip')) {
              return NodeFilter.FILTER_ACCEPT;
            }
            return NodeFilter.FILTER_REJECT;
          }
        }
      );

      let node;
      while (node = walker.nextNode()) {
        const textNode = node as Text;
        const parent = textNode.parentElement;
        if (parent) {
          const html = parent.innerHTML;
          const regex = new RegExp(`(${text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
          // Store comment IDs instead of full JSON
          const commentIds = textComments.map(c => c.id).join(',');
          parent.innerHTML = html.replace(regex, `<span class="feedback-highlight" data-comment-ids="${commentIds}" data-selected-text="${text.replace(/"/g, '&quot;')}">$1</span>`);
        }
      }
    });

    // Add hover listeners to highlighted spans
    setTimeout(() => {
      document.querySelectorAll('.feedback-highlight').forEach(span => {
        span.addEventListener('mouseenter', handleHighlightHover);
        span.addEventListener('mouseleave', handleHighlightLeave);
      });
    }, 100);
  };

  const handleHighlightHover = (e: Event) => {
    const span = e.target as HTMLSpanElement;
    const rect = span.getBoundingClientRect();
    const commentIds = span.getAttribute('data-comment-ids');
    const selectedText = span.getAttribute('data-selected-text');
    
    if (commentIds && selectedText) {
      const ids = commentIds.split(',');
      const relevantComments = comments.filter(c => 
        ids.includes(c.id) && c.selected_text === selectedText.replace(/&quot;/g, '"')
      );
      
      setTooltip({
        show: true,
        x: rect.left + rect.width / 2,
        y: rect.top - 10,
        comments: relevantComments
      });
    }
  };

  const handleHighlightLeave = () => {
    setTooltip({ show: false, x: 0, y: 0, comments: [] });
  };

  useEffect(() => {
    highlightCommentedText();
  }, [comments]);

  return (
    <>
      {showAuth && (
        <div className="feedback-overlay">
          <div className="feedback-auth-modal">
            <h3>Welcome! Please enter your Telegram username to continue</h3>
            <form onSubmit={handleAuth}>
              <input
                type="text"
                name="telegram_name"
                placeholder="@username"
                required
                autoFocus
              />
              <button type="submit">Continue</button>
            </form>
          </div>
        </div>
      )}

      {showCommentBox && username && (
        <div 
          className="feedback-comment-popup"
          style={{
            left: `${position.x}px`,
            top: `${position.y}px`
          }}
        >
          <div className="feedback-selected-text">
            {selectedText.length > 100 
              ? `${selectedText.substring(0, 100)}...` 
              : selectedText
            }
          </div>
          <textarea
            value={comment}
            onChange={(e) => setComment((e.target as HTMLTextAreaElement).value)}
            placeholder="Add your comment..."
            autoFocus
          />
          <div className="feedback-actions">
            <button onClick={() => {
              setShowCommentBox(false);
              window.getSelection()?.removeAllRanges();
            }}>Cancel</button>
            <button onClick={handleSubmitComment} className="primary">Submit</button>
          </div>
        </div>
      )}

      {tooltip.show && (
        <div 
          className="feedback-tooltip"
          style={{
            left: `${tooltip.x}px`,
            top: `${tooltip.y}px`
          }}
        >
          <div className="feedback-tooltip-header">Comments ({tooltip.comments.length})</div>
          {tooltip.comments.map(comment => (
            <div key={comment.id} className="feedback-tooltip-comment">
              <div className="feedback-tooltip-author">{comment.telegram_name}</div>
              <div className="feedback-tooltip-text">{comment.comment}</div>
              <div className="feedback-tooltip-time">
                {new Date(comment.created_at).toLocaleDateString()}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="feedback-indicator">
        {comments.length > 0 && (
          <span>{comments.length} comments on this page</span>
        )}
      </div>
    </>
  );
}

const styles = `
#docs-feedback-widget {
  position: fixed;
  z-index: 9999;
}

.feedback-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.feedback-auth-modal {
  background: white;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-width: 400px;
  width: 90%;
}

.feedback-auth-modal h3 {
  margin: 0 0 1.5rem 0;
  font-size: 1.2rem;
  color: #333;
}

.feedback-auth-modal input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 1rem;
  margin-bottom: 1rem;
  box-sizing: border-box;
}

.feedback-auth-modal button {
  width: 100%;
  padding: 0.75rem;
  background: #0066cc;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 1rem;
  cursor: pointer;
  transition: background 0.2s;
}

.feedback-auth-modal button:hover {
  background: #0052a3;
}

.feedback-comment-popup {
  position: fixed;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 1rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  min-width: 300px;
  z-index: 10001;
  transform: translateX(-50%);
}

.feedback-comment-popup::before {
  content: '';
  position: absolute;
  bottom: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid white;
}

.feedback-selected-text {
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 0.75rem;
  padding: 0.5rem;
  background: #f5f5f5;
  border-radius: 4px;
  max-height: 60px;
  overflow-y: auto;
  line-height: 1.4;
  word-break: break-word;
}

.feedback-comment-popup textarea {
  width: 100%;
  min-height: 80px;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 0.9rem;
  resize: vertical;
  font-family: inherit;
  box-sizing: border-box;
}

.feedback-actions {
  display: flex;
  gap: 0.5rem;
  margin-top: 0.75rem;
  justify-content: flex-end;
}

.feedback-actions button {
  padding: 0.5rem 1rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  background: white;
  cursor: pointer;
  font-size: 0.9rem;
  transition: all 0.2s;
}

.feedback-actions button.primary {
  background: #0066cc;
  color: white;
  border-color: #0066cc;
}

.feedback-actions button:hover {
  background: #f5f5f5;
}

.feedback-actions button.primary:hover {
  background: #0052a3;
}

.feedback-highlight {
  background: #fff3cd;
  padding: 2px 0;
  border-bottom: 2px solid #ffc107;
  cursor: pointer;
  position: relative;
}

.feedback-indicator {
  position: fixed;
  bottom: 20px;
  right: 20px;
  background: #333;
  color: white;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  font-size: 0.85rem;
  opacity: 0.8;
}

.feedback-tooltip {
  position: fixed;
  background: white;
  border: 1px solid #ddd;
  border-radius: 8px;
  padding: 0.75rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  max-width: 350px;
  z-index: 10002;
  transform: translateX(-50%) translateY(-100%);
  margin-top: -10px;
}

.feedback-tooltip::after {
  content: '';
  position: absolute;
  top: 100%;
  left: 50%;
  transform: translateX(-50%);
  width: 0;
  height: 0;
  border-left: 8px solid transparent;
  border-right: 8px solid transparent;
  border-top: 8px solid white;
}

.feedback-tooltip-header {
  font-weight: 600;
  color: #333;
  margin-bottom: 0.5rem;
  font-size: 0.9rem;
}

.feedback-tooltip-comment {
  padding: 0.5rem 0;
  border-bottom: 1px solid #eee;
}

.feedback-tooltip-comment:last-child {
  border-bottom: none;
}

.feedback-tooltip-author {
  font-weight: 500;
  color: #0066cc;
  font-size: 0.85rem;
  margin-bottom: 0.25rem;
}

.feedback-tooltip-text {
  color: #333;
  font-size: 0.9rem;
  margin-bottom: 0.25rem;
}

.feedback-tooltip-time {
  color: #999;
  font-size: 0.75rem;
}
`;

if (typeof window !== 'undefined') {
  // Wait for DOM to be ready
  const initWidget = () => {
    try {
      // Inject styles
      const styleSheet = document.createElement('style');
      styleSheet.textContent = styles;
      document.head.appendChild(styleSheet);
      
      // Create and mount widget
      const container = document.createElement('div');
      container.id = 'docs-feedback-widget';
      document.body.appendChild(container);
      render(<FeedbackWidget />, container);
    } catch (err) {
      console.error('Failed to initialize feedback widget:', err);
    }
  };
  
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initWidget);
  } else {
    initWidget();
  }
}