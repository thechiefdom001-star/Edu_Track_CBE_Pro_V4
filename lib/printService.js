export const PrintService = {
    print: (orientation = 'portrait', extraBodyClasses = []) => {
        const orientationClass = orientation === 'landscape' ? 'landscape-mode' : 'portrait-mode';
        const classesToApply = [orientationClass, ...extraBodyClasses];

        document.body.classList.remove('portrait-mode', 'landscape-mode', 'print-receipt-only', 'print-table-only');
        document.body.classList.add(...classesToApply);

        const existingStyle = document.getElementById('dynamic-print-style');
        if (existingStyle) existingStyle.remove();

        const printStyle = document.createElement('style');
        printStyle.id = 'dynamic-print-style';
        printStyle.media = 'print';
        printStyle.textContent = `@page { size: A4 ${orientation}; margin: 10mm; }`;
        document.head.appendChild(printStyle);

        const cleanup = () => {
            document.body.classList.remove(...classesToApply);
            printStyle.remove();
            window.removeEventListener('afterprint', cleanup);
        };

        window.addEventListener('afterprint', cleanup, { once: true });

        setTimeout(() => {
            window.print();
        }, 50);
    }
};
