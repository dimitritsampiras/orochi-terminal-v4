// import PDFDocument from 'pdfkit';
// import type { AssemblyLineItem } from '../assembly/generate-assembly-line';
// import type { Enums, Tables } from '$lib/types/database';
// import dayjs from 'dayjs';

// export const generateAssemblyList = async (
// 	assemblyLine: AssemblyLineItem[],
// 	batch: Pick<Tables<'batches'>, 'id' | 'created_at' | 'active'>
// ) => {
// 	const marginX = 50;
// 	const marginY = 50;

// 	// Create a PDF document
// 	const doc = new PDFDocument({
// 		size: 'A4',
// 		margins: {
// 			top: marginY,
// 			bottom: marginY,
// 			left: marginX,
// 			right: marginX
// 		}
// 	});

// 	let pageNumber = 1;

// 	// Add title and header information only on the first page

// 	doc.font('Helvetica-Bold').fontSize(12).text('Assembly Line');
// 	doc
// 		.font('Helvetica')
// 		.fontSize(10)
// 		.text(`Session number: ${batch.id}`)
// 		.text(`Created At: ${dayjs(batch.created_at).format('MMMM D, YYYY')}`)
// 		.moveDown(1);

// 	// Table headers
// 	const headers = [' ', 'Name', 'Size', 'Color', 'Type', 'Stock', 'Check'];
// 	const colWidths = [20, 130, 70, 100, 110, 50, 50];

// 	// Function to draw table row
// 	const drawRow = (items: string[], doc: PDFKit.PDFDocument) => {
// 		doc.fontSize(10);
// 		const y = doc.y;
// 		items.forEach((item, i) => {
// 			doc.text(item, marginX + colWidths.slice(0, i).reduce((a, b) => a + b, 0), y, {
// 				width: colWidths[i]
// 			});
// 		});
// 		doc.moveDown(0.5);
// 	};

// 	// Draw table headers
// 	doc.font('Helvetica-Bold');
// 	drawRow(headers, doc);
// 	doc.font('Helvetica');

// 	// Draw table rows
// 	for (const lineItem of assemblyLine) {
// 		// Check if we need a new page

// 		if (doc.y > doc.page.height - marginY - 30) {
// 			doc.y = marginY;
// 			doc.addPage();
// 			pageNumber++;
// 			const fixedY = doc.y;
// 			doc.fontSize(8).text(`${pageNumber}`, doc.page.width - 60, doc.page.height - marginY - 10);
// 			doc.y = fixedY;
// 			doc.font('Helvetica-Bold');
// 			drawRow(headers, doc);
// 			doc.font('Helvetica');
// 		}

// 		const rowData = [
// 			(assemblyLine.map((li) => li.id).indexOf(lineItem.id) + 1 || '-').toString(),
// 			normalize(lineItem.name.split(' - ')[0]),
// 			dbSizeToDisplaySize(lineItem.product_variants?.blank_variants?.size),
// 			lineItem.product_variants?.blank_variants?.color || '--',
// 			lineItem.products?.blanks
// 				? `${lineItem.products.blanks.garment_type} (${abreviateBlankname(lineItem.products.blanks.blank_company)}) `
// 				: '--',
// 			(lineItem.product_variants?.warehouse_inventory || '--').toString() || '--',
// 			lineItem.quantity > 1 ? `____ x${lineItem.quantity}` : '____'
// 		];
// 		drawRow(rowData, doc);
// 	}

// 	const pdfBuffer = await new Promise<Buffer>((resolve) => {
// 		const chunks: Uint8Array[] = [];
// 		doc.on('data', (chunk) => chunks.push(chunk));
// 		doc.on('end', () => resolve(Buffer.concat(chunks)));
// 		doc.end();
// 	});

// 	return pdfBuffer;
// };

// const normalize = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// const dbSizeToDisplaySize = (size?: Enums<'garment_size'>): string => {
// 	if (!size) return '--';
// 	const map: Record<Enums<'garment_size'>, string> = {
// 		xs: 'xsmall',
// 		sm: 'small',
// 		md: 'medium',
// 		lg: 'large',
// 		xl: 'xlarge',
// 		'2xl': '2XL',
// 		'3xl': '3XL',
// 		'4xl': '4XL',
// 		'5xl': '5XL',
// 		os: 'one-size'
// 	};
// 	return map[size];
// };

// const abreviateBlankname = (name: string) => {
// 	if (name === 'independant') return 'ind';
// 	return name;
// };
