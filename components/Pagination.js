import { h, Fragment } from 'preact';
import { Pagination } from '../lib/pagination.js';

/**
 * Reusable Pagination Component
 * Displays pagination controls and info
 * 
 * Props:
 * - currentPage: Current page number (1-indexed)
 * - onPageChange: Callback when page changes
 * - totalItems: Total number of items
 * - itemsPerPage: Items to show per page
 * - maxButtons: Max page buttons to show (default: 5)
 */
export const PaginationControls = ({ 
    currentPage = 1, 
    onPageChange = () => {},
    totalItems = 0,
    itemsPerPage = 10,
    maxButtons = 5
}) => {
    try {
        const safeTotalItems = totalItems || 0;
        const safeItemsPerPage = itemsPerPage || 10;
        const metadata = Pagination.getPaginationMetadata([...Array(safeTotalItems)], currentPage, safeItemsPerPage);
        const pageRange = Pagination.getPageRange(currentPage, metadata.totalPages, maxButtons);
        
        // Don't show pagination if only one page or invalid
        if (!metadata || metadata.totalPages <= 1) {
            return null;  // Return null instead of Fragment
        }

        const handlePreviousPage = () => {
            if (metadata.hasPreviousPage) {
                onPageChange(currentPage - 1);
            }
        };

        const handleNextPage = () => {
            if (metadata.hasNextPage) {
                onPageChange(currentPage + 1);
            }
        };

        const handleGoToPage = (page) => {
            onPageChange(page);
        };

        // Build page buttons
        const pageButtons = pageRange.map(page => 
            h('button', {
                key: `page-${page}`,
                onClick: () => handleGoToPage(page),
                class: `px-3 py-1 rounded-lg text-sm font-bold transition-colors ${
                    page === currentPage
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer'
                }`,
                title: `Go to page ${page}`
            },
            String(page))
        );

        return h('div', { class: 'flex items-center justify-between gap-4 p-4 bg-slate-50 border-t border-slate-100 rounded-b-2xl no-print print:hidden' },
            h('div', { class: 'text-xs font-semibold text-slate-600' },
                'Showing ',
                h('span', { class: 'text-slate-900 font-bold' }, String(metadata.startIndex + 1)),
                ' to ',
                h('span', { class: 'text-slate-900 font-bold' }, String(Math.min(metadata.endIndex, totalItems))),
                ' of ',
                h('span', { class: 'text-slate-900 font-bold' }, String(totalItems)),
                ' items',
                h('span', { class: 'text-slate-400 ml-2' }, `(Page ${currentPage}/${metadata.totalPages})`)
            ),
            h('div', { class: 'flex items-center gap-2' },
                h('button', {
                    onClick: handlePreviousPage,
                    disabled: !metadata.hasPreviousPage,
                    class: `px-3 py-1 rounded-lg text-sm font-bold transition-colors ${
                        metadata.hasPreviousPage
                            ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer'
                            : 'bg-slate-100 border border-slate-100 text-slate-400 cursor-not-allowed'
                    }`,
                    title: 'Previous page'
                }, '← Prev'),
                h('div', { class: 'flex gap-1' }, pageButtons),
                h('button', {
                    onClick: handleNextPage,
                    disabled: !metadata.hasNextPage,
                    class: `px-3 py-1 rounded-lg text-sm font-bold transition-colors ${
                        metadata.hasNextPage
                            ? 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 cursor-pointer'
                            : 'bg-slate-100 border border-slate-100 text-slate-400 cursor-not-allowed'
                    }`,
                    title: 'Next page'
                }, 'Next →')
            ),
            h('div', { class: 'hidden md:flex items-center gap-2' },
                h('span', { class: 'text-xs font-semibold text-slate-600' }, 'Per page:'),
                h('select', {
                    class: 'px-2 py-1 rounded-lg text-sm border border-slate-200 bg-white font-semibold text-slate-600 focus:ring-2 focus:ring-blue-500 outline-none',
                    onChange: (e) => {
                        const newItemsPerPage = Number(e.target.value);
                        onPageChange(1, newItemsPerPage);
                    }
                },
                    [
                        h('option', { value: '10' }, '10'),
                        h('option', { value: '25' }, '25'),
                        h('option', { value: '50' }, '50'),
                        h('option', { value: '100' }, '100')
                    ]
                )
            )
        );
    } catch (error) {
        console.error('PaginationControls error:', error);
        return h(Fragment);
    }
};
