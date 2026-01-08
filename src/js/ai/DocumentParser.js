class DocumentParser {
    constructor() {
        this.supportedTypes = [
            'text/csv',
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'application/pdf',
            'image/png',
            'image/jpeg',
            'image/jpg'
        ];

        // Initialize PDF.js worker if available
        if (window.pdfjsLib) {
            window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'src/vendor/pdf.worker.min.js';
        }
    }

    /**
     * Parse an uploaded file and return raw text/data
     * @param {File} file 
     * @returns {Promise<any>}
     */
    async parse(file) {
        if (!file) throw new Error('No file provided');

        const type = this.detectType(file);
        console.log(`Parsing file: ${file.name} (${type})`);

        switch (type) {
            case 'excel':
                return this.parseSpreadsheet(file);
            case 'csv':
                return this.parseSpreadsheet(file); // SheetJS handles CSV too
            case 'pdf':
                return this.parsePDF(file);
            case 'image':
                return this.parseImage(file);
            default:
                throw new Error(`Unsupported file type: ${file.type || file.name}`);
        }
    }

    detectType(file) {
        if (file.type === 'text/csv' || file.name.endsWith('.csv')) return 'csv';
        if (file.type.includes('spreadsheet') || file.type.includes('excel') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) return 'excel';
        if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) return 'pdf';
        if (file.type.startsWith('image/') || /\.(jpg|jpeg|png)$/i.test(file.name)) return 'image';
        return 'unknown';
    }

    async parseSpreadsheet(file) {
        if (!window.XLSX) throw new Error('SheetJS not loaded');

        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    const json = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
                    resolve(json);
                } catch (err) {
                    reject(err);
                }
            };
            reader.onerror = reject;
            reader.readAsArrayBuffer(file);
        });
    }

    async parsePDF(file) {
        if (!window.pdfjsLib) throw new Error('PDF.js not loaded');

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            let text = '';

            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const content = await page.getTextContent();
                const strings = content.items.map(item => item.str);
                text += strings.join(' ') + '\n';
            }

            return text;
        } catch (err) {
            console.error('PDF parsing error:', err);
            throw err;
        }
    }

    async parseImage(file) {
        if (!window.Tesseract) throw new Error('Tesseract.js not loaded');

        try {
            const result = await Tesseract.recognize(file, 'eng', {
                // logger: m => console.log(m) // Optional logging
            });

            return result.data.text;
        } catch (err) {
            console.error('OCR error:', err);
            throw err;
        }
    }
}

// Attach to window for global access
window.DocumentParser = DocumentParser;
