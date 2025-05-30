// CSRF Token setup for AJAX requests
const csrfToken = document.querySelector('meta[name="csrf-token"]').content;

// Add CSRF token to all fetch requests
function fetchWithCSRF(url, options = {}) {
    const defaultOptions = {
        headers: {
            'X-CSRFToken': csrfToken,
            'Content-Type': 'application/json'
        },
        credentials: 'same-origin'
    };
    return fetch(url, { ...defaultOptions, ...options });
}

// Budget Category Management
class BudgetAPI {
    static async getCategories() {
        const response = await fetchWithCSRF('/api/budget/categories');
        return response.json();
    }

    static async createCategory(name, dailyAmount) {
        const response = await fetchWithCSRF('/api/budget/categories', {
            method: 'POST',
            body: JSON.stringify({ name, daily_amount: dailyAmount })
        });
        return response.json();
    }

    static async updateCategory(categoryId, name, dailyAmount) {
        const response = await fetchWithCSRF(`/api/budget/categories/${categoryId}`, {
            method: 'PUT',
            body: JSON.stringify({ name, daily_amount: dailyAmount })
        });
        return response.json();
    }

    static async deleteCategory(categoryId) {
        await fetchWithCSRF(`/api/budget/categories/${categoryId}`, {
            method: 'DELETE'
        });
    }

    static async getTransactions(page = 1, perPage = 10) {
        const response = await fetchWithCSRF(`/api/transactions?page=${page}&per_page=${perPage}`);
        return response.json();
    }
}

// Budget UI Management
class BudgetUIManager {
    static getRemainingDaysInMonth() {
        const today = new Date();
        const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0);
        const remainingDays = lastDay.getDate() - today.getDate() + 1; // +1 to include today
        return remainingDays;
    }

    static getCurrentMonthName() {
        return new Date().toLocaleString('en-US', { month: 'long' });
    }

    static async refreshCategoriesList() {
        const categories = await BudgetAPI.getCategories();
        const categoriesList = document.querySelector('#categoriesList');
        const viewAllButton = document.querySelector('#categoriesViewAll');
        if (!categoriesList) return;

        // Update current month name
        const monthElement = document.querySelector('#currentMonth');
        if (monthElement) {
            const today = new Date();
            const formattedDate = `${this.getCurrentMonthName()} (${today.getDate()}-${new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()})`;
            monthElement.textContent = formattedDate;
        }

        categoriesList.innerHTML = '';
        let totalDaily = 0;

        categories.forEach(category => {
            totalDaily += category.daily_amount;
            const element = this._createCategoryElement(category);
            categoriesList.appendChild(element);
        });

        // Always enforce limited view by default
        categoriesList.classList.add('limited');

        // Show/hide view all button based on number of categories
        if (viewAllButton) {
            const hasMoreThanThree = categories.length > 3;
            viewAllButton.classList.toggle('d-none', !hasMoreThanThree);
            if (hasMoreThanThree) {
                const viewMoreText = viewAllButton.querySelector('.view-more-text');
                const icon = viewAllButton.querySelector('i');
                viewMoreText.textContent = 'View All Categories';
                icon.className = 'fas fa-chevron-down ms-1';
            }
        }

        // Update daily budget
        const totalElement = document.querySelector('#totalDailyBudget');
        if (totalElement) {
            totalElement.textContent = `KES ${totalDaily.toFixed(2)}`;
        }

        // Update monthly budget using remaining days in current month
        const monthlyElement = document.querySelector('#monthlyBudget');
        if (monthlyElement) {
            const remainingDays = this.getRemainingDaysInMonth();
            const monthlyTotal = totalDaily * remainingDays;
            monthlyElement.textContent = `KES ${monthlyTotal.toFixed(2)}`;
        }
    }

    static toggleCategoriesView() {
        const categoriesList = document.querySelector('#categoriesList');
        const viewAllButton = document.querySelector('#categoriesViewAll');
        const viewMoreText = viewAllButton.querySelector('.view-more-text');
        const icon = viewAllButton.querySelector('i');

        if (categoriesList.classList.contains('limited')) {
            categoriesList.classList.remove('limited');
            viewMoreText.textContent = 'Show Less';
            icon.classList.replace('fa-chevron-down', 'fa-chevron-up');
        } else {
            categoriesList.classList.add('limited');
            viewMoreText.textContent = 'View All Categories';
            icon.classList.replace('fa-chevron-up', 'fa-chevron-down');
        }
    }

    static _createCategoryElement(category) {
        const div = document.createElement('div');
        div.className = 'list-group-item category-item';
        div.innerHTML = `
            <div class="category-info">
                <h6 class="mb-0">${category.name}</h6>
                <small class="text-muted">Daily: KES ${category.daily_amount.toFixed(2)}</small>
            </div>
            <div class="category-actions">
                <button type="button" class="category-action-btn edit" data-category-id="${category.id}" title="Edit category">
                    <i class="fas fa-pencil-alt"></i>
                </button>
                <button type="button" class="category-action-btn delete" data-category-id="${category.id}" title="Delete category">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;

        // Add event listeners for the buttons
        const editBtn = div.querySelector('.category-action-btn.edit');
        const deleteBtn = div.querySelector('.category-action-btn.delete');

        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.editCategory(category.id);
        });

        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.deleteCategory(category.id);
        });

        return div;
    }

    static async editCategory(categoryId) {
        const categories = await BudgetAPI.getCategories();
        const category = categories.find(c => c.id === categoryId);
        
        if (!category) return;

        // Populate modal
        document.getElementById('categoryName').value = category.name;
        document.getElementById('dailyAmount').value = category.daily_amount;
        
        const form = document.getElementById('categoryForm');
        form.dataset.categoryId = categoryId;
        
        // Show modal
        const modal = new bootstrap.Modal(document.getElementById('categoryModal'));
        modal.show();
    }

    static async deleteCategory(categoryId) {
        if (!confirm('Are you sure you want to delete this category?')) return;
        
        try {
            await BudgetAPI.deleteCategory(categoryId);
            await this.refreshCategoriesList();
            showAlert('Category deleted successfully', 'success');
        } catch (error) {
            showAlert('Failed to delete category', 'danger');
        }
    }

    static async loadTransactions(page = 1) {
        const response = await BudgetAPI.getTransactions(page);
        const transactionsList = document.querySelector('#transactionsList');
        if (!transactionsList) return;

        transactionsList.innerHTML = response.transactions.map(t => `
            <div class="list-group-item">
                <div class="d-flex justify-content-between align-items-center">
                    <div>
                        <h6 class="mb-0">${t.description}</h6>
                        <small class="text-muted">${new Date(t.created_at).toLocaleString()}</small>
                    </div>
                    <span class="badge ${t.type === 'credit' ? 'bg-success' : 'bg-danger'}">
                        KES ${t.amount.toFixed(2)}
                    </span>
                </div>
            </div>
        `).join('');

        // Update pagination
        this.updatePagination(response.current_page, response.total_pages);
    }

    static updatePagination(currentPage, totalPages) {
        const pagination = document.querySelector('#transactionsPagination');
        if (!pagination) return;

        pagination.innerHTML = '';
        
        for (let i = 1; i <= totalPages; i++) {
            const li = document.createElement('li');
            li.className = `page-item ${i === currentPage ? 'active' : ''}`;
            li.innerHTML = `
                <a class="page-link" href="#" onclick="BudgetUIManager.loadTransactions(${i})">${i}</a>
            `;
            pagination.appendChild(li);
        }
    }
}

// MPESA Integration
class MPESAManager {
    static async initiateTransfer(amount) {
        try {
            const response = await fetchWithCSRF('/mpesa/transfer', {
                method: 'POST',
                body: JSON.stringify({ amount })
            });

            const result = await response.json();
            
            if (result.success) {
                this.checkTransactionStatus(result.transactionId);
            } else {
                throw new Error(result.message || 'Transfer failed');
            }
        } catch (error) {
            console.error('Error initiating transfer:', error);
            alert('Failed to initiate MPESA transfer');
        }
    }

    static async checkTransactionStatus(transactionId) {
        try {
            const response = await fetchWithCSRF(`/mpesa/status/${transactionId}`);
            const status = await response.json();

            if (status.pending) {
                // Check again in 5 seconds
                setTimeout(() => this.checkTransactionStatus(transactionId), 5000);
            } else if (status.success) {
                alert('Transfer completed successfully');
                window.location.reload();
            } else {
                throw new Error(status.message || 'Transaction failed');
            }
        } catch (error) {
            console.error('Error checking transaction status:', error);
            alert('Failed to verify transaction status');
        }
    }
}

// Deposit Function
function initiateDeposit() {
    // Call STK Push API
    fetchWithCSRF('/api/mpesa/deposit', {
        method: 'POST'
    })
    .then(response => response.json())
    .then(result => {
        if (result.success) {
            showAlert('Please check your phone for the M-Pesa prompt', 'info');
            // Check transaction status after a delay
            setTimeout(() => checkDepositStatus(result.checkoutRequestID), 5000);
        } else {
            showAlert('Failed to initiate deposit: ' + result.message, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Failed to initiate deposit. Please try again.', 'danger');
    });
}

function checkDepositStatus(checkoutRequestID) {
    fetchWithCSRF(`/api/mpesa/deposit/status/${checkoutRequestID}`)
    .then(response => response.json())
    .then(result => {
        if (result.pending) {
            // Check again after 5 seconds
            setTimeout(() => checkDepositStatus(checkoutRequestID), 5000);
        } else if (result.success) {
            showAlert('Deposit successful!', 'success');
            // Reload transactions list
            BudgetUIManager.loadTransactions();
        } else {
            showAlert('Deposit failed: ' + result.message, 'danger');
        }
    })
    .catch(error => {
        console.error('Error:', error);
        showAlert('Failed to check deposit status', 'danger');
    });
}

// Balance visibility toggle
function toggleBalanceVisibility() {
    const balanceContainer = document.querySelector('.balance-container');
    const icon = document.getElementById('balanceToggleIcon');
    
    if (balanceContainer.classList.contains('hidden')) {
        balanceContainer.classList.remove('hidden');
        icon.classList.replace('fa-eye-slash', 'fa-eye');
    } else {
        balanceContainer.classList.add('hidden');
        icon.classList.replace('fa-eye', 'fa-eye-slash');
    }
}

// Form Validation
document.addEventListener('DOMContentLoaded', () => {
    // Phone number validation
    const phoneInput = document.querySelector('input[type="tel"]');
    if (phoneInput) {
        phoneInput.addEventListener('input', (e) => {
            const value = e.target.value.replace(/\D/g, '');
            if (value.length > 9) {
                e.target.value = value.slice(0, 9);
            } else {
                e.target.value = value;
            }
        });
    }

    // Budget form validation
    const budgetForms = document.querySelectorAll('form[id$="CategoryForm"]');
    budgetForms.forEach(form => {
        form.addEventListener('submit', (e) => {
            const amountInput = form.querySelector('input[name="daily_amount"]');
            if (amountInput && parseFloat(amountInput.value) <= 0) {
                e.preventDefault();
                alert('Amount must be greater than 0');
            }
        });
    });

    // Initialize budget management if on dashboard
    const categoriesList = document.querySelector('#categoriesList');
    if (categoriesList) {
        BudgetUIManager.refreshCategoriesList();
        BudgetUIManager.loadTransactions();
    }

    // Category form submission
    const categoryForm = document.getElementById('categoryForm');
    if (categoryForm) {
        categoryForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            
            const categoryId = categoryForm.dataset.categoryId;
            const name = document.getElementById('categoryName').value;
            const dailyAmount = parseFloat(document.getElementById('dailyAmount').value);

            try {
                if (categoryId) {
                    await BudgetAPI.updateCategory(categoryId, name, dailyAmount);
                } else {
                    await BudgetAPI.createCategory(name, dailyAmount);
                }

                const modal = bootstrap.Modal.getInstance(document.getElementById('categoryModal'));
                modal.hide();
                await BudgetUIManager.refreshCategoriesList();
                showAlert('Category saved successfully', 'success');
            } catch (error) {
                showAlert('Failed to save category', 'danger');
            }
        });
    }
});

// Dashboard Initialization
function initializeDashboard() {
    // Initialize tooltips
    const tooltips = document.querySelectorAll('[data-bs-toggle="tooltip"]');
    tooltips.forEach(tooltip => new bootstrap.Tooltip(tooltip));

    // Initialize charts if needed
    // Add chart initialization code here if you decide to add charts
}

// Utility Functions
function showAlert(message, type = 'info') {
    const alertContainer = document.querySelector('#alertContainer');
    if (!alertContainer) return;

    const alert = document.createElement('div');
    alert.className = `alert alert-${type} alert-dismissible fade show`;
    alert.innerHTML = `
        ${message}
        <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
    `;
    
    alertContainer.appendChild(alert);
    setTimeout(() => alert.remove(), 5000);
}

// Budget Manager Object
const BudgetManager = {
    // Budget management functions
    updateBudget: function(amount) {
        console.log('Budget updated with amount:', amount);
    }
};

// Export functionality for use in other scripts
window.BudgetManager = BudgetManager;
window.MPESAManager = MPESAManager;
window.initializeDashboard = initializeDashboard;