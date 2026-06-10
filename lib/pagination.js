/**
 * Pagination Utility Functions
 * Provides helpers for paginating data arrays
 */

export const Pagination = {
    /**
     * Calculate pagination metadata
     * @param {Array} items - Full array of items
     * @param {number} currentPage - Current page number (1-indexed)
     * @param {number} itemsPerPage - Items per page
     * @returns {Object} Pagination metadata
     */
    getPaginationMetadata: (items = [], currentPage = 1, itemsPerPage = 10) => {
        const totalItems = items.length;
        const totalPages = Math.ceil(totalItems / itemsPerPage);
        const validPage = Math.min(Math.max(1, currentPage), Math.max(1, totalPages));
        
        return {
            totalItems,
            totalPages,
            currentPage: validPage,
            itemsPerPage,
            hasNextPage: validPage < totalPages,
            hasPreviousPage: validPage > 1,
            startIndex: (validPage - 1) * itemsPerPage,
            endIndex: validPage * itemsPerPage
        };
    },

    /**
     * Get paginated items for current page
     * @param {Array} items - Full array of items
     * @param {number} currentPage - Current page number (1-indexed)
     * @param {number} itemsPerPage - Items per page
     * @returns {Array} Items for current page
     */
    getPageItems: (items = [], currentPage = 1, itemsPerPage = 10) => {
        const metadata = Pagination.getPaginationMetadata(items, currentPage, itemsPerPage);
        return items.slice(metadata.startIndex, metadata.endIndex);
    },

    /**
     * Calculate page range for pagination buttons
     * @param {number} currentPage - Current page
     * @param {number} totalPages - Total number of pages
     * @param {number} maxButtons - Max page buttons to show
     * @returns {Array} Array of page numbers to display
     */
    getPageRange: (currentPage, totalPages, maxButtons = 5) => {
        const pages = [];
        const halfButtons = Math.floor(maxButtons / 2);
        
        let startPage = Math.max(1, currentPage - halfButtons);
        let endPage = Math.min(totalPages, startPage + maxButtons - 1);
        
        if (endPage - startPage + 1 < maxButtons) {
            startPage = Math.max(1, endPage - maxButtons + 1);
        }
        
        for (let i = startPage; i <= endPage; i++) {
            pages.push(i);
        }
        
        return pages;
    }
};
