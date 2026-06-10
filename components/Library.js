import { h } from 'preact';
import { useState } from 'preact/hooks';
import htm from 'htm';
import { PrintButtons } from './PrintButtons.js';

const html = htm.bind(h);

export const Library = ({ data, setData }) => {
    const [view, setView] = useState('inventory'); // 'inventory' or 'borrow'
    const [showAddBook, setShowAddBook] = useState(false);
    const [editingBookId, setEditingBookId] = useState(null);
    const [newBook, setNewBook] = useState({ title: '', author: '', isbn: '', quantity: 1 });
    
    const [selectedBookId, setSelectedBookId] = useState('');
    const [selectedStudentId, setSelectedStudentId] = useState('');
    const [searchTerm, setSearchTerm] = useState('');

    const library = data.library || { books: [], transactions: [] };
    const students = data.students || [];

    const handleAddBook = (e) => {
        e.preventDefault();
        const bookData = { ...newBook, quantity: Number(newBook.quantity) || 1 };
        
        if (editingBookId) {
            const updatedBooks = library.books.map(b => 
                b.id === editingBookId ? { ...b, ...bookData } : b
            );
            setData({
                ...data,
                library: { ...library, books: updatedBooks }
            });
            setEditingBookId(null);
        } else {
            const id = 'b-' + Date.now();
            const updatedBooks = [...library.books, { ...bookData, id, status: 'Available' }];
            setData({
                ...data,
                library: { ...library, books: updatedBooks }
            });
        }
        setNewBook({ title: '', author: '', isbn: '', quantity: 1 });
        setShowAddBook(false);
    };

    const handleEditBook = (book) => {
        setNewBook({ title: book.title, author: book.author, isbn: book.isbn, quantity: book.quantity || 1 });
        setEditingBookId(book.id);
        setShowAddBook(true);
    };

    const handleBorrow = (e) => {
        e.preventDefault();
        const book = library.books.find(b => b.id === selectedBookId);
        
        // 1. Check if book exists and is in stock
        if (!book || (Number(book.quantity) || 0) <= 0) {
            alert("This book is currently out of stock.");
            return;
        }

        // 2. Check if student already has a book borrowed (Limit 1 book)
        const activeLoan = library.transactions.find(t => t.studentId === selectedStudentId && t.status === 'Borrowed');
        if (activeLoan) {
            const borrowedBook = library.books.find(b => b.id === activeLoan.bookId);
            const bookTitle = borrowedBook && borrowedBook.title ? borrowedBook.title : 'book';
            alert('This student already has an active loan: "' + bookTitle + '". They must return it first.');
            return;
        }

        const transaction = {
            id: 'tr-' + Date.now(),
            bookId: selectedBookId,
            studentId: selectedStudentId,
            borrowDate: new Date().toLocaleDateString(),
            returnDate: null,
            status: 'Borrowed'
        };

        // 3. Decrement quantity
        const updatedBooks = library.books.map(b => {
            if (b.id === selectedBookId) {
                const newQty = (Number(b.quantity) || 1) - 1;
                return { ...b, quantity: newQty, status: newQty > 0 ? 'Available' : 'Out of Stock' };
            }
            return b;
        });

        setData({
            ...data,
            library: {
                ...library,
                books: updatedBooks,
                transactions: [...library.transactions, transaction]
            }
        });
        setSelectedBookId('');
        setSelectedStudentId('');
    };

    const handleReturn = (transactionId) => {
        const transaction = library.transactions.find(t => t.id === transactionId);
        if (!transaction) return;

        const updatedTransactions = library.transactions.map(t => 
            t.id === transactionId ? { ...t, returnDate: new Date().toLocaleDateString(), status: 'Returned' } : t
        );

        // 4. Increment quantity
        const updatedBooks = library.books.map(b => {
            if (b.id === transaction.bookId) {
                const newQty = (Number(b.quantity) || 0) + 1;
                return { ...b, quantity: newQty, status: 'Available' };
            }
            return b;
        });

        setData({
            ...data,
            library: {
                ...library,
                books: updatedBooks,
                transactions: updatedTransactions
            }
        });
    };

    const handleDeleteBook = (id) => {
        if (confirm('Delete this book from library?')) {
            setData({
                ...data,
                library: {
                    ...library,
                    books: library.books.filter(b => b.id !== id)
                }
            });
        }
    };

    const toggleAddBook = () => {
        if (showAddBook) {
            setEditingBookId(null);
            setNewBook({ title: '', author: '', isbn: '', quantity: 1 });
        }
        setShowAddBook(!showAddBook);
    };

    const totalBooks = library.books.reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
    const availableBooks = library.books.filter(b => b.status === 'Available').reduce((sum, b) => sum + (Number(b.quantity) || 0), 0);
    const borrowedBooks = totalBooks - availableBooks;

    return html`
        <div class="space-y-6">
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-2 no-print">
                <div class="bg-blue-50 p-4 rounded-2xl border border-blue-100">
                    <p class="text-[10px] font-bold text-blue-600 uppercase">Total Collection</p>
                    <p class="text-2xl font-black text-blue-900">${totalBooks}</p>
                </div>
                <div class="bg-green-50 p-4 rounded-2xl border border-green-100">
                    <p class="text-[10px] font-bold text-green-600 uppercase">Available for Loan</p>
                    <p class="text-2xl font-black text-green-900">${availableBooks}</p>
                </div>
                <div class="bg-orange-50 p-4 rounded-2xl border border-orange-100">
                    <p class="text-[10px] font-bold text-orange-600 uppercase">Currently Borrowed</p>
                    <p class="text-2xl font-black text-orange-900">${borrowedBooks}</p>
                </div>
            </div>

            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
                <div>
                    <h2 class="text-2xl font-bold">School Library</h2>
                    <p class="text-slate-500">Manage book inventory and student borrowing</p>
                </div>
                <div class="flex gap-2">
                    <button 
                        onClick=${() => setView('inventory')}
                        class=${`px-4 py-2 rounded-xl text-sm font-medium transition-all ${view === 'inventory' ? 'bg-blue-600 text-white shadow-md' : 'bg-white border text-slate-600'}`}
                    >
                        Inventory
                    </button>
                    <button 
                        onClick=${() => setView('borrow')}
                        class=${`px-4 py-2 rounded-xl text-sm font-medium transition-all ${view === 'borrow' ? 'bg-blue-600 text-white shadow-md' : 'bg-white border text-slate-600'}`}
                    >
                        Borrowing Log
                    </button>
                    <div class="relative no-print">
                        <input 
                            type="text"
                            placeholder=${view === 'inventory' ? "Search books..." : "Search logs..."}
                            class="p-2 pl-8 bg-white border border-slate-200 rounded-xl outline-none w-48 text-sm font-bold"
                            value=${searchTerm}
                            onInput=${(e) => setSearchTerm(e.target.value)}
                        />
                        <span class="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">🔍</span>
                    </div>
                    <${PrintButtons} />
                </div>
            </div>

            ${view === 'inventory' && html`
                <div class="space-y-6">
                    <div class="flex justify-between items-center no-print">
                        <h3 class="font-bold text-lg">Book Collection</h3>
                        <button 
                            onClick=${toggleAddBook}
                            class="text-blue-600 text-sm font-bold uppercase hover:underline"
                        >
                            ${showAddBook ? 'Cancel' : '+ Add New Book'}
                        </button>
                    </div>

                    ${showAddBook && html`
                        <form onSubmit=${handleAddBook} class="bg-white p-6 rounded-2xl border border-blue-100 shadow-sm grid grid-cols-1 md:grid-cols-5 gap-4 animate-in slide-in-from-top-2 no-print">
                            <div class="space-y-1 md:col-span-2">
                                <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Book Title</label>
                                <input required class="w-full p-3 bg-slate-50 rounded-xl outline-none" value=${newBook.title} onInput=${e => setNewBook({...newBook, title: e.target.value})} />
                            </div>
                            <div class="space-y-1">
                                <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Author</label>
                                <input required class="w-full p-3 bg-slate-50 rounded-xl outline-none" value=${newBook.author} onInput=${e => setNewBook({...newBook, author: e.target.value})} />
                            </div>
                            <div class="space-y-1">
                                <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">ISBN</label>
                                <input class="w-full p-3 bg-slate-50 rounded-xl outline-none" value=${newBook.isbn} onInput=${e => setNewBook({...newBook, isbn: e.target.value})} />
                            </div>
                            <div class="space-y-1">
                                <label class="text-[10px] font-bold text-slate-400 uppercase ml-1">Quantity</label>
                                <input type="number" min="1" required class="w-full p-3 bg-slate-50 rounded-xl outline-none" value=${newBook.quantity} onInput=${e => setNewBook({...newBook, quantity: e.target.value})} />
                            </div>
                            <div class="flex items-end md:col-span-5">
                                <button class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold">
                                    ${editingBookId ? 'Update Book' : 'Register Book'}
                                </button>
                            </div>
                        </form>
                    `}

                    
                    <div class="hidden print:flex flex-col items-center text-center border-b pb-2 mb-2">
                        <img src="${data.settings.schoolLogo}" class="w-12 h-12 mb-1 object-contain" alt="Logo" />
                        <h1 class="text-xl font-black uppercase text-slate-900">${data.settings.schoolName}</h1>
                        <p class="text-[10px] text-slate-500 font-medium">${data.settings.schoolAddress}</p>
                        <div class="mt-2 border-t border-slate-200 w-full pt-2">
                            <h2 class="text-sm font-extrabold uppercase tracking-widest text-blue-600">Library Inventory Report</h2>
                        </div>
                    </div>

                    <div class="library-container bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                        <table class="w-full text-left min-w-[700px]">
                            <thead class="bg-slate-50 border-b">
                                <tr>
                                    <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Book Details</th>
                                    <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">ISBN</th>
                                    <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase text-center">Qty</th>
                                    <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Status</th>
                                    <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase no-print">Action</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-50">
                                ${(library.books || [])
                                    .filter(book => {
                                        if (!searchTerm) return true;
                                        const searchLower = searchTerm.toLowerCase();
                                        return (book.title && book.title.toLowerCase().includes(searchLower)) ||
                                               (book.author && book.author.toLowerCase().includes(searchLower)) ||
                                               (book.isbn && book.isbn.toLowerCase().includes(searchLower));
                                    })
                                    .map(book => html`
                                    <tr key=${book.id} class="hover:bg-slate-100 even:bg-slate-50">
                                        <td class="px-6 py-4">
                                            <div class="font-bold text-sm">${book.title}</div>
                                            <div class="text-[10px] text-slate-400 uppercase">By ${book.author}</div>
                                        </td>
                                        <td class="px-6 py-4 text-xs font-mono text-slate-500">${book.isbn || 'N/A'}</td>
                                        <td class="px-6 py-4 text-center font-bold text-slate-600 text-sm">${book.quantity || 1}</td>
                                        <td class="px-6 py-4">
                                            <span class=${`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                book.status === 'Available' ? 'bg-green-100 text-green-700' : 'bg-orange-100 text-orange-700'
                                            }`}>
                                                ${book.status}
                                            </span>
                                        </td>
                                        <td class="px-6 py-4 no-print">
                                            <div class="flex items-center gap-3">
                                                <button onClick=${() => handleEditBook(book)} class="text-blue-600 text-[10px] font-bold uppercase hover:underline">Edit</button>
                                                ${book.status === 'Borrowed' && html`
                                                    <button 
                                                        onClick=${() => {
                                                            const tx = library.transactions.find(t => t.bookId === book.id && t.status === 'Borrowed');
                                                            if (tx) handleReturn(tx.id);
                                                        }} 
                                                        class="text-green-600 text-[10px] font-bold uppercase hover:underline"
                                                    >
                                                        Mark Returned
                                                    </button>
                                                `}
                                                <button onClick=${() => handleDeleteBook(book.id)} class="text-red-500 text-[10px] font-bold uppercase hover:underline">Del</button>
                                            </div>
                                        </td>
                                    </tr>
                                `)}
                            </tbody>
                        </table>
                    </div>
                </div>
            `}

            ${view === 'borrow' && html`
                <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div class="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm no-print">
                        <h3 class="font-bold mb-4">Issue Book</h3>
                        <form onSubmit=${handleBorrow} class="space-y-4">
                            <div class="space-y-1">
                                <label class="text-[10px] font-bold text-slate-400 uppercase">Select Book</label>
                                <select 
                                    required
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none"
                                    value=${selectedBookId}
                                    onChange=${e => setSelectedBookId(e.target.value)}
                                >
                                    <option value="">Choose Available Book</option>
                                    ${library.books.filter(b => b.status === 'Available').map(b => html`
                                        <option value=${b.id}>${b.title}</option>
                                    `)}
                                </select>
                            </div>
                            <div class="space-y-1">
                                <label class="text-[10px] font-bold text-slate-400 uppercase">Select Student</label>
                                <select 
                                    required
                                    class="w-full p-3 bg-slate-50 rounded-xl outline-none"
                                    value=${selectedStudentId}
                                    onChange=${e => setSelectedStudentId(e.target.value)}
                                >
                                    <option value="">Choose Student</option>
                                    ${students.map(s => html`
                                        <option value=${s.id}>${s.name} (${s.grade})</option>
                                    `)}
                                </select>
                            </div>
                            <button class="w-full bg-blue-600 text-white py-3 rounded-xl font-bold shadow-lg shadow-blue-100">Lend Book</button>
                        </form>
                    </div>

                    <div class="library-container lg:col-span-2 bg-white rounded-2xl border border-slate-100 shadow-sm overflow-x-auto no-scrollbar">
                        <table class="w-full text-left min-w-[600px]">
                            <thead class="bg-slate-50 border-b">
                                <tr>
                                    <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Borrower / Book</th>
                                    <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Dates</th>
                                    <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase">Status</th>
                                    <th class="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase no-print">Action</th>
                                </tr>
                            </thead>
                            <tbody class="divide-y divide-slate-50">
                                ${(library.transactions || [])
                                    .slice().reverse()
                                    .filter(t => {
                                        if (!searchTerm) return true;
                                        const book = library.books.find(b => b.id === t.bookId);
                                        const student = (students || []).find(s => String(s.id) === String(t.studentId));
                                        const searchLower = searchTerm.toLowerCase();
                                        return (student && student.name && student.name.toLowerCase().includes(searchLower)) ||
                                               (book && book.title && book.title.toLowerCase().includes(searchLower));
                                    })
                                    .map(t => {
                                    const book = library.books.find(b => b.id === t.bookId);
                                    const student = (students || []).find(s => String(s.id) === String(t.studentId));
                                    const studentName = student && student.name ? student.name : 'Unknown';
                                    const bookTitle = book && book.title ? book.title : 'Unknown Book';
                                    return html`
                                        <tr key=${t.id} class="hover:bg-slate-50 text-sm">
                                            <td class="px-6 py-4">
                                                <div class="font-bold">${studentName}</div>
                                                <div class="text-[10px] text-slate-400">${bookTitle}</div>
                                            </td>
                                            <td class="px-6 py-4">
                                                <div class="text-[10px]">Out: ${t.borrowDate}</div>
                                                <div class="text-[10px] text-green-600">${t.returnDate ? `In: ${t.returnDate}` : 'Pending'}</div>
                                            </td>
                                            <td class="px-6 py-4">
                                                <span class=${`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                                    t.status === 'Borrowed' ? 'bg-orange-100 text-orange-700' : 'bg-green-100 text-green-700'
                                                }`}>
                                                    ${t.status}
                                                </span>
                                            </td>
                                            <td class="px-6 py-4 no-print">
                                                ${t.status === 'Borrowed' && html`
                                                    <button onClick=${() => handleReturn(t.id)} class="text-blue-600 text-[10px] font-bold uppercase hover:underline">Return</button>
                                                `}
                                            </td>
                                        </tr>
                                    `;
                                })}
                                ${library.transactions.length === 0 && html`<tr><td colspan="4" class="p-12 text-center text-slate-300">No borrowing history yet</td></tr>`}
                            </tbody>
                        </table>
                    </div>
                </div>
            `}

            
            <div class="mt-6 pt-3 border-t border-slate-200 print:border-black">
                <div class="flex justify-between items-center text-[8px] text-slate-400">
                    <span>${data.settings.schoolName} - ${data.settings.schoolAddress}</span>
                    <span>Academic Year: ${data.settings.academicYear}</span>
                    <span>Library Report</span>
                </div>
            </div>
        </div>
    `;
};