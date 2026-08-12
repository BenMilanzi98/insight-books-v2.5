'use client';

import { useState, useEffect } from 'react';
import { toYmdLocal, todayYmdLocal } from '@/lib/dateUtils';
import { 
  PlusIcon, 
  PencilIcon, 
  TrashIcon, 
  EyeIcon, 
  CheckIcon, 
  X,
  Star,
  Target,
  MessageSquare,
  TrendingUp,
  Calendar,
  User
} from 'lucide-react';
import PosStylePageHeader from '@/components/shell/PosStylePageHeader';
import PosStylePanel from '@/components/shell/PosStylePanel';

export default function PerformanceManagement() {
  const [activeTab, setActiveTab] = useState('reviews');
  const [reviews, setReviews] = useState([]);
  const [goals, setGoals] = useState([]);
  const [feedback, setFeedback] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showGoalModal, setShowGoalModal] = useState(false);
  const [showFeedbackModal, setShowFeedbackModal] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [editingGoal, setEditingGoal] = useState(null);
  const [editingFeedback, setEditingFeedback] = useState(null);
  const [filters, setFilters] = useState({
    employeeId: '',
    status: 'All',
    reviewType: 'All',
    year: new Date().getFullYear()
  });

  // Load data
  useEffect(() => {
    loadEmployees();
    if (activeTab === 'reviews') {
      loadReviews();
    } else if (activeTab === 'goals') {
      loadGoals();
    } else if (activeTab === 'feedback') {
      loadFeedback();
    }
  }, [activeTab, filters]);

  const loadEmployees = async () => {
    try {
      const response = await fetch('/api/employees?limit=1000&isActive=true');
      const data = await response.json();
      if (response.ok) {
        setEmployees(data.employees || []);
      }
    } catch (error) {
      console.error('Error loading employees:', error);
    }
  };

  const loadReviews = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: '1',
        limit: '100',
        ...(filters.employeeId && { employeeId: filters.employeeId }),
        ...(filters.status !== 'All' && { status: filters.status }),
        ...(filters.reviewType !== 'All' && { reviewType: filters.reviewType }),
        ...(filters.year && { year: filters.year.toString() })
      });
      
      const response = await fetch(`/api/performance-reviews?${params}`);
      const data = await response.json();
      if (response.ok) {
        setReviews(data.reviews || []);
      } else {
        console.error('Error loading reviews:', data.error);
      }
    } catch (error) {
      console.error('Error loading reviews:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadGoals = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: '1',
        limit: '100',
        ...(filters.employeeId && { employeeId: filters.employeeId }),
        ...(filters.status !== 'All' && { status: filters.status })
      });
      
      const response = await fetch(`/api/performance-goals?${params}`);
      const data = await response.json();
      if (response.ok) {
        setGoals(data.goals || []);
      } else {
        console.error('Error loading goals:', data.error);
      }
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFeedback = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: '1',
        limit: '100',
        ...(filters.employeeId && { employeeId: filters.employeeId }),
        ...(filters.status !== 'All' && { status: filters.status })
      });
      
      const response = await fetch(`/api/performance-feedback?${params}`);
      const data = await response.json();
      if (response.ok) {
        setFeedback(data.feedback || []);
      } else {
        console.error('Error loading feedback:', data.error);
      }
    } catch (error) {
      console.error('Error loading feedback:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleReviewSubmit = async (reviewData) => {
    try {
      const url = editingReview ? `/api/performance-reviews/${editingReview.id}` : '/api/performance-reviews';
      const method = editingReview ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData)
      });
      
      const data = await response.json();
      if (response.ok) {
        await loadReviews();
        setShowReviewModal(false);
        setEditingReview(null);
      } else {
        alert(data.error || 'Failed to save review');
      }
    } catch (error) {
      console.error('Error saving review:', error);
      alert('Failed to save review');
    }
  };

  const handleGoalSubmit = async (goalData) => {
    try {
      const url = editingGoal ? `/api/performance-goals/${editingGoal.id}` : '/api/performance-goals';
      const method = editingGoal ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(goalData)
      });
      
      const data = await response.json();
      if (response.ok) {
        await loadGoals();
        setShowGoalModal(false);
        setEditingGoal(null);
      } else {
        alert(data.error || 'Failed to save goal');
      }
    } catch (error) {
      console.error('Error saving goal:', error);
      alert('Failed to save goal');
    }
  };

  const handleFeedbackSubmit = async (feedbackData) => {
    try {
      const url = editingFeedback ? `/api/performance-feedback/${editingFeedback.id}` : '/api/performance-feedback';
      const method = editingFeedback ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(feedbackData)
      });
      
      const data = await response.json();
      if (response.ok) {
        await loadFeedback();
        setShowFeedbackModal(false);
        setEditingFeedback(null);
      } else {
        alert(data.error || 'Failed to save feedback');
      }
    } catch (error) {
      console.error('Error saving feedback:', error);
      alert('Failed to save feedback');
    }
  };

  const handleCompleteReview = async (reviewId) => {
    try {
      const response = await fetch(`/api/performance-reviews/${reviewId}/complete`, {
        method: 'POST'
      });
      
      const data = await response.json();
      if (response.ok) {
        await loadReviews();
      } else {
        alert(data.error || 'Failed to complete review');
      }
    } catch (error) {
      console.error('Error completing review:', error);
      alert('Failed to complete review');
    }
  };

  const handleDeleteReview = async (reviewId) => {
    if (!confirm('Are you sure you want to delete this review?')) return;
    
    try {
      const response = await fetch(`/api/performance-reviews/${reviewId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      if (response.ok) {
        await loadReviews();
      } else {
        alert(data.error || 'Failed to delete review');
      }
    } catch (error) {
      console.error('Error deleting review:', error);
      alert('Failed to delete review');
    }
  };

  const handleDeleteGoal = async (goalId) => {
    if (!confirm('Are you sure you want to delete this goal?')) return;
    
    try {
      const response = await fetch(`/api/performance-goals/${goalId}`, {
        method: 'DELETE'
      });
      
      const data = await response.json();
      if (response.ok) {
        await loadGoals();
      } else {
        alert(data.error || 'Failed to delete goal');
      }
    } catch (error) {
      console.error('Error deleting goal:', error);
      alert('Failed to delete goal');
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'acknowledged': return 'bg-blue-100 text-blue-800';
      case 'active': return 'bg-blue-100 text-blue-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      case 'on-hold': return 'bg-yellow-100 text-yellow-800';
      case 'submitted': return 'bg-blue-100 text-blue-800';
      case 'reviewed': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getRatingStars = (rating) => {
    if (!rating) return 'N/A';
    const fullStars = Math.floor(rating);
    const hasHalfStar = rating % 1 >= 0.5;
    return '★'.repeat(fullStars) + (hasHalfStar ? '½' : '') + '☆'.repeat(5 - fullStars - (hasHalfStar ? 1 : 0));
  };

  return (
    <div className="p-6">
      <PosStylePageHeader
        title="Performance Management"
        description="Manage performance reviews, goals, and feedback"
      />

      {/* Tabs */}
      <div className="mb-6">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveTab('reviews')}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'reviews'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Star className="h-4 w-4" />
              Performance Reviews
            </button>
            <button
              onClick={() => setActiveTab('goals')}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'goals'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Target className="h-4 w-4" />
              Performance Goals
            </button>
            <button
              onClick={() => setActiveTab('feedback')}
              className={`py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2 ${
                activeTab === 'feedback'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <MessageSquare className="h-4 w-4" />
              360° Feedback
            </button>
          </nav>
        </div>
      </div>

      {/* Filters */}
      <PosStylePanel className="mb-4 p-4">
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Employee</label>
          <select
            value={filters.employeeId}
            onChange={(e) => setFilters({ ...filters, employeeId: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="">All Employees</option>
            {employees.map(emp => (
              <option key={emp.id} value={emp.id}>
                {emp.name} {emp.employeeId ? `(${emp.employeeId})` : ''}
              </option>
            ))}
          </select>
        </div>
        {activeTab === 'reviews' && (
          <>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Review Type</label>
              <select
                value={filters.reviewType}
                onChange={(e) => setFilters({ ...filters, reviewType: e.target.value })}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                <option value="All">All Types</option>
                <option value="annual">Annual</option>
                <option value="quarterly">Quarterly</option>
                <option value="mid-year">Mid-Year</option>
                <option value="probation">Probation</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
              <select
                value={filters.year}
                onChange={(e) => setFilters({ ...filters, year: parseInt(e.target.value) })}
                className="border border-gray-300 rounded-md px-3 py-2 text-sm"
              >
                {[new Date().getFullYear() - 2, new Date().getFullYear() - 1, new Date().getFullYear(), new Date().getFullYear() + 1].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </>
        )}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={filters.status}
            onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            className="border border-gray-300 rounded-md px-3 py-2 text-sm"
          >
            <option value="All">All Statuses</option>
            {activeTab === 'reviews' && (
              <>
                <option value="draft">Draft</option>
                <option value="completed">Completed</option>
                <option value="acknowledged">Acknowledged</option>
              </>
            )}
            {activeTab === 'goals' && (
              <>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
                <option value="on-hold">On Hold</option>
              </>
            )}
            {activeTab === 'feedback' && (
              <>
                <option value="submitted">Submitted</option>
                <option value="reviewed">Reviewed</option>
                <option value="archived">Archived</option>
              </>
            )}
          </select>
        </div>
      </div>
      </PosStylePanel>

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Performance Reviews</h2>
            <button
              onClick={() => {
                setEditingReview(null);
                setShowReviewModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              New Review
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading reviews...</div>
          ) : reviews.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No performance reviews found</div>
          ) : (
            <PosStylePanel className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Review Period</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Goals</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {reviews.map((review) => (
                    <tr key={review.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{review.employee?.name}</div>
                        <div className="text-sm text-gray-500">{review.employee?.jobTitle}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {review.reviewPeriod}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        {review.reviewType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {review.overallRating ? (
                          <div className="flex items-center gap-1">
                            <span className="text-yellow-500">{getRatingStars(review.overallRating)}</span>
                            <span className="text-gray-600">({review.overallRating.toFixed(1)})</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {review.goalsAchieved}/{review.goalsTotal}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(review.status)}`}>
                          {review.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <div className="flex space-x-2">
                          <button
                            onClick={() => {
                              setEditingReview(review);
                              setShowReviewModal(true);
                            }}
                            className="text-blue-600 hover:text-blue-900"
                            title="View/Edit"
                          >
                            <EyeIcon className="h-4 w-4" />
                          </button>
                          {review.status === 'draft' && (
                            <button
                              onClick={() => handleCompleteReview(review.id)}
                              className="text-green-600 hover:text-green-900"
                              title="Complete"
                            >
                              <CheckIcon className="h-4 w-4" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDeleteReview(review.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PosStylePanel>
          )}
        </div>
      )}

      {/* Goals Tab */}
      {activeTab === 'goals' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">Performance Goals</h2>
            <button
              onClick={() => {
                setEditingGoal(null);
                setShowGoalModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              New Goal
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading goals...</div>
          ) : goals.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No performance goals found</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {goals.map((goal) => (
                <div key={goal.id} className="tenant-glass-card p-4">
                  <div className="flex justify-between items-start mb-2">
                    <h3 className="font-semibold text-gray-900">{goal.title}</h3>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(goal.status)}`}>
                      {goal.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 mb-3">{goal.description}</p>
                  <div className="mb-3">
                    <div className="flex justify-between text-xs text-gray-600 mb-1">
                      <span>Progress</span>
                      <span>{goal.progress.toFixed(0)}%</span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all"
                        style={{ width: `${goal.progress}%` }}
                      ></div>
                    </div>
                  </div>
                  {goal.targetValue && (
                    <div className="text-sm text-gray-600 mb-2">
                      Target: {goal.targetValue} {goal.targetUnit || ''}
                      {goal.currentValue !== null && (
                        <span className="ml-2">Current: {goal.currentValue}</span>
                      )}
                    </div>
                  )}
                  <div className="text-xs text-gray-500 mb-3">
                    <div>Start: {new Date(goal.startDate).toLocaleDateString()}</div>
                    <div>Target: {new Date(goal.targetDate).toLocaleDateString()}</div>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => {
                        setEditingGoal(goal);
                        setShowGoalModal(true);
                      }}
                      className="text-blue-600 hover:text-blue-900 text-sm"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteGoal(goal.id)}
                      className="text-red-600 hover:text-red-900 text-sm"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Feedback Tab */}
      {activeTab === 'feedback' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold">360° Feedback</h2>
            <button
              onClick={() => {
                setEditingFeedback(null);
                setShowFeedbackModal(true);
              }}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <PlusIcon className="h-4 w-4" />
              New Feedback
            </button>
          </div>

          {loading ? (
            <div className="text-center py-8">Loading feedback...</div>
          ) : feedback.length === 0 ? (
            <div className="text-center py-8 text-gray-500">No feedback found</div>
          ) : (
            <PosStylePanel className="overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">From</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rating</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {feedback.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{item.employee?.name}</div>
                        <div className="text-sm text-gray-500">{item.employee?.jobTitle}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {item.isAnonymous ? 'Anonymous' : item.feedbackGiver?.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">
                        {item.feedbackType}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {item.rating ? (
                          <div className="flex items-center gap-1">
                            <span className="text-yellow-500">{getRatingStars(item.rating)}</span>
                            <span className="text-gray-600">({item.rating.toFixed(1)})</span>
                          </div>
                        ) : (
                          <span className="text-gray-400">N/A</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(item.status)}`}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button
                          onClick={() => {
                            setEditingFeedback(item);
                            setShowFeedbackModal(true);
                          }}
                          className="text-blue-600 hover:text-blue-900"
                          title="View Details"
                        >
                          <EyeIcon className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </PosStylePanel>
          )}
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && (
        <ReviewModal
          review={editingReview}
          employees={employees}
          onClose={() => {
            setShowReviewModal(false);
            setEditingReview(null);
          }}
          onSubmit={handleReviewSubmit}
        />
      )}

      {/* Goal Modal */}
      {showGoalModal && (
        <GoalModal
          goal={editingGoal}
          employees={employees}
          onClose={() => {
            setShowGoalModal(false);
            setEditingGoal(null);
          }}
          onSubmit={handleGoalSubmit}
        />
      )}

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <FeedbackModal
          feedback={editingFeedback}
          employees={employees}
          onClose={() => {
            setShowFeedbackModal(false);
            setEditingFeedback(null);
          }}
          onSubmit={handleFeedbackSubmit}
        />
      )}
    </div>
  );
}

// Review Modal Component
function ReviewModal({ review, employees, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    employeeId: '',
    reviewPeriod: '',
    reviewType: 'annual',
    reviewDate: todayYmdLocal(),
    overallRating: '',
    overallComments: '',
    strengths: '',
    areasForImprovement: '',
    reviewCriteria: [{ criteriaName: '', rating: '', comments: '', weight: '1.0' }]
  });

  useEffect(() => {
    if (review) {
      setFormData({
        employeeId: review.employeeId || '',
        reviewPeriod: review.reviewPeriod || '',
        reviewType: review.reviewType || 'annual',
        reviewDate: review.reviewDate ? toYmdLocal(review.reviewDate) : todayYmdLocal(),
        overallRating: review.overallRating?.toString() || '',
        overallComments: review.overallComments || '',
        strengths: review.strengths || '',
        areasForImprovement: review.areasForImprovement || '',
        reviewCriteria: review.reviewCriteria && review.reviewCriteria.length > 0
          ? review.reviewCriteria.map(c => ({
              criteriaName: c.criteriaName,
              rating: c.rating.toString(),
              comments: c.comments || '',
              weight: c.weight.toString()
            }))
          : [{ criteriaName: '', rating: '', comments: '', weight: '1.0' }]
      });
    }
  }, [review]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const addCriteria = () => {
    setFormData({
      ...formData,
      reviewCriteria: [...formData.reviewCriteria, { criteriaName: '', rating: '', comments: '', weight: '1.0' }]
    });
  };

  const removeCriteria = (index) => {
    setFormData({
      ...formData,
      reviewCriteria: formData.reviewCriteria.filter((_, i) => i !== index)
    });
  };

  const updateCriteria = (index, field, value) => {
    const updated = [...formData.reviewCriteria];
    updated[index] = { ...updated[index], [field]: value };
    setFormData({ ...formData, reviewCriteria: updated });
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white max-h-[90vh] overflow-y-auto">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {review ? 'Edit Performance Review' : 'New Performance Review'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Employee *</label>
              <select
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
                disabled={!!review}
              >
                <option value="">Select an employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {emp.employeeId ? `(${emp.employeeId})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Review Period *</label>
                <input
                  type="text"
                  value={formData.reviewPeriod}
                  onChange={(e) => setFormData({ ...formData, reviewPeriod: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Q1 2024, Annual 2024"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Review Type *</label>
                <select
                  value={formData.reviewType}
                  onChange={(e) => setFormData({ ...formData, reviewType: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                >
                  <option value="annual">Annual</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="mid-year">Mid-Year</option>
                  <option value="probation">Probation</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Review Date *</label>
              <input
                type="date"
                value={formData.reviewDate}
                onChange={(e) => setFormData({ ...formData, reviewDate: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Overall Rating (1-5)</label>
              <input
                type="number"
                min="1"
                max="5"
                step="0.1"
                value={formData.overallRating}
                onChange={(e) => setFormData({ ...formData, overallRating: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Review Criteria</label>
              {formData.reviewCriteria.map((criteria, index) => (
                <div key={index} className="mb-3 p-3 border border-gray-200 rounded-md">
                  <div className="grid grid-cols-2 gap-2 mb-2">
                    <input
                      type="text"
                      placeholder="Criteria Name"
                      value={criteria.criteriaName}
                      onChange={(e) => updateCriteria(index, 'criteriaName', e.target.value)}
                      className="border border-gray-300 rounded-md px-2 py-1 text-sm"
                    />
                    <div className="flex gap-2">
                      <input
                        type="number"
                        min="1"
                        max="5"
                        step="0.1"
                        placeholder="Rating"
                        value={criteria.rating}
                        onChange={(e) => updateCriteria(index, 'rating', e.target.value)}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm flex-1"
                      />
                      <input
                        type="number"
                        min="0"
                        step="0.1"
                        placeholder="Weight"
                        value={criteria.weight}
                        onChange={(e) => updateCriteria(index, 'weight', e.target.value)}
                        className="border border-gray-300 rounded-md px-2 py-1 text-sm w-20"
                      />
                      {formData.reviewCriteria.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeCriteria(index)}
                          className="text-red-600 hover:text-red-800"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                  <textarea
                    placeholder="Comments"
                    value={criteria.comments}
                    onChange={(e) => updateCriteria(index, 'comments', e.target.value)}
                    className="w-full border border-gray-300 rounded-md px-2 py-1 text-sm"
                    rows="2"
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={addCriteria}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                + Add Criteria
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Strengths</label>
              <textarea
                value={formData.strengths}
                onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                rows="3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Areas for Improvement</label>
              <textarea
                value={formData.areasForImprovement}
                onChange={(e) => setFormData({ ...formData, areasForImprovement: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                rows="3"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Overall Comments</label>
              <textarea
                value={formData.overallComments}
                onChange={(e) => setFormData({ ...formData, overallComments: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                rows="3"
              />
            </div>

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                {review ? 'Update' : 'Create'} Review
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Goal Modal Component
function GoalModal({ goal, employees, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    employeeId: '',
    title: '',
    description: '',
    category: '',
    targetValue: '',
    targetUnit: '',
    startDate: todayYmdLocal(),
    targetDate: '',
    progress: '0',
    currentValue: ''
  });

  useEffect(() => {
    if (goal) {
      setFormData({
        employeeId: goal.employeeId || '',
        title: goal.title || '',
        description: goal.description || '',
        category: goal.category || '',
        targetValue: goal.targetValue?.toString() || '',
        targetUnit: goal.targetUnit || '',
        startDate: goal.startDate ? toYmdLocal(goal.startDate) : todayYmdLocal(),
        targetDate: goal.targetDate ? toYmdLocal(goal.targetDate) : '',
        progress: goal.progress?.toString() || '0',
        currentValue: goal.currentValue?.toString() || ''
      });
    }
  }, [goal]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {goal ? 'Edit Performance Goal' : 'New Performance Goal'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Employee *</label>
              <select
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
                disabled={!!goal}
              >
                <option value="">Select an employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {emp.employeeId ? `(${emp.employeeId})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Goal Title *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Description</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                rows="3"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Category</label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  placeholder="e.g., Sales, Quality"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Target Value</label>
                <input
                  type="number"
                  value={formData.targetValue}
                  onChange={(e) => setFormData({ ...formData, targetValue: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Target Unit</label>
              <input
                type="text"
                value={formData.targetUnit}
                onChange={(e) => setFormData({ ...formData, targetUnit: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                placeholder="e.g., sales, projects, percentage"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Start Date *</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Target Date *</label>
                <input
                  type="date"
                  value={formData.targetDate}
                  onChange={(e) => setFormData({ ...formData, targetDate: e.target.value })}
                  className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  required
                />
              </div>
            </div>

            {goal && (
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Current Value</label>
                  <input
                    type="number"
                    value={formData.currentValue}
                    onChange={(e) => setFormData({ ...formData, currentValue: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Progress (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.progress}
                    onChange={(e) => setFormData({ ...formData, progress: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                {goal ? 'Update' : 'Create'} Goal
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

// Feedback Modal Component
function FeedbackModal({ feedback, employees, onClose, onSubmit }) {
  const [formData, setFormData] = useState({
    employeeId: '',
    feedbackGiverId: '',
    feedbackType: 'peer',
    rating: '',
    strengths: '',
    areasForImprovement: '',
    suggestions: '',
    isAnonymous: false
  });

  useEffect(() => {
    if (feedback) {
      setFormData({
        employeeId: feedback.employeeId || '',
        feedbackGiverId: feedback.feedbackGiverId || '',
        feedbackType: feedback.feedbackType || 'peer',
        rating: feedback.rating?.toString() || '',
        strengths: feedback.strengths || '',
        areasForImprovement: feedback.areasForImprovement || '',
        suggestions: feedback.suggestions || '',
        isAnonymous: feedback.isAnonymous || false
      });
    }
  }, [feedback]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-lg shadow-lg rounded-md bg-white">
        <div className="mt-3">
          <h3 className="text-lg font-medium text-gray-900 mb-4">
            {feedback ? 'View Feedback' : 'New Feedback'}
          </h3>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Employee Receiving Feedback *</label>
              <select
                value={formData.employeeId}
                onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
                disabled={!!feedback}
              >
                <option value="">Select an employee</option>
                {employees.map(emp => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} {emp.employeeId ? `(${emp.employeeId})` : ''}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Feedback From *</label>
              <select
                value={formData.feedbackGiverId}
                onChange={(e) => setFormData({ ...formData, feedbackGiverId: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
                disabled={!!feedback}
              >
                <option value="">Select an employee</option>
                {employees
                  .filter(emp => emp.id !== formData.employeeId)
                  .map(emp => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} {emp.employeeId ? `(${emp.employeeId})` : ''}
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Feedback Type *</label>
              <select
                value={formData.feedbackType}
                onChange={(e) => setFormData({ ...formData, feedbackType: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                required
                disabled={!!feedback}
              >
                <option value="peer">Peer</option>
                <option value="manager">Manager</option>
                <option value="subordinate">Subordinate</option>
                <option value="self">Self</option>
                <option value="360">360°</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Rating (1-5)</label>
              <input
                type="number"
                min="1"
                max="5"
                step="0.1"
                value={formData.rating}
                onChange={(e) => setFormData({ ...formData, rating: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                disabled={!!feedback}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Strengths</label>
              <textarea
                value={formData.strengths}
                onChange={(e) => setFormData({ ...formData, strengths: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                rows="3"
                disabled={!!feedback}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Areas for Improvement</label>
              <textarea
                value={formData.areasForImprovement}
                onChange={(e) => setFormData({ ...formData, areasForImprovement: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                rows="3"
                disabled={!!feedback}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700">Suggestions</label>
              <textarea
                value={formData.suggestions}
                onChange={(e) => setFormData({ ...formData, suggestions: e.target.value })}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                rows="3"
                disabled={!!feedback}
              />
            </div>

            {!feedback && (
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={formData.isAnonymous}
                  onChange={(e) => setFormData({ ...formData, isAnonymous: e.target.checked })}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">Submit anonymously</label>
              </div>
            )}

            <div className="flex justify-end space-x-3 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-md hover:bg-gray-200"
              >
                {feedback ? 'Close' : 'Cancel'}
              </button>
              {!feedback && (
                <button
                  type="submit"
                  className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700"
                >
                  Submit Feedback
                </button>
              )}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

