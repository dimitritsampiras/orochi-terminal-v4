// 'use client';

// import type { GetCategoriesResponse, GetProductsResponse, Pagination } from '@/lib/types/api';

// import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

// import {
//   DropdownMenu,
//   DropdownMenuContent,
//   DropdownMenuItem,
//   DropdownMenuTrigger
// } from '@/components/ui/dropdown-menu';

// import {
//   Table,
//   TableBody,
//   TableCell,
//   TableHead,
//   TableHeader,
//   TableRow
// } from '@/components/ui/table';
// import type { CheckedState } from '@radix-ui/react-checkbox';
// import { useState } from 'react';
// import Image from 'next/image';
// import { Icon } from '@iconify/react';
// import { Badge } from '../ui/badge';
// import { cn } from '@/lib/utils';
// import { ActiveStatusBadge } from '../badges/active-status-badge';
// import { buttonVariants } from '../ui/button';
// import { Checkbox } from '../ui/checkbox';
// import { EditProductStockForm } from '../forms/product-forms/edit-product-stock-form';
// import type { locations } from '../../../drizzle/schema';
// import EditProductForm from '../forms/product-forms/edit-product-form';
// import ActivateProductForm from '../forms/product-forms/activate-product-form';
// import { PaginationController } from '../pagination-controller';

// type Product = NonNullable<GetProductsResponse['data']>['products'][number];

// function ProductsTable({
//   pagination,
//   products,
//   locs,
//   categories
// }: {
//   pagination: Pagination;
//   products: Product[];
//   locs: Pick<typeof locations.$inferSelect, 'id' | 'name' | 'address'>[];
//   categories: NonNullable<GetCategoriesResponse['data']>;
// }) {
//   const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);

//   const [isEditProductDialogOpen, setIsEditProductDialogOpen] = useState(false);
//   const [isEditStockDialogOpen, setIsEditStockDialogOpen] = useState(false);
//   const [isActivateProductDialogOpen, setIsActivateProductDialogOpen] = useState(false);

//   const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

//   const handleSelect = (id: number) => {
//     setSelectedProductIds((prev) =>
//       prev.includes(id) ? prev.filter((productId) => productId !== id) : [...prev, id]
//     );
//   };

//   const handleSelectAll = (checked: CheckedState) => {
//     if (checked === true) {
//       setSelectedProductIds(products.map((product) => product.id));
//     } else {
//       setSelectedProductIds([]);
//     }
//   };

//   const handleEditProduct = (product: Product) => {
//     setSelectedProduct(product);
//     setIsEditProductDialogOpen(true);
//   };

//   const handleEditProductStock = (product: Product) => {
//     setSelectedProduct(product);
//     setIsEditStockDialogOpen(true);
//   };

//   const handleActivateProduct = (product: Product) => {
//     setSelectedProduct(product);
//     setIsActivateProductDialogOpen(true);
//   };

//   return (
//     <>
//       {selectedProduct && (
//         <EditProductStockForm
//           product={selectedProduct}
//           locs={locs}
//           isOpen={isEditStockDialogOpen}
//           onOpenChange={setIsEditStockDialogOpen}
//         />
//       )}

//       {selectedProduct && (
//         <EditProductForm
//           product={selectedProduct}
//           categories={categories}
//           isOpen={isEditProductDialogOpen}
//           onOpenChange={setIsEditProductDialogOpen}
//         />
//       )}

//       {selectedProduct && (
//         <ActivateProductForm
//           product={selectedProduct}
//           isOpen={isActivateProductDialogOpen}
//           onOpenChange={setIsActivateProductDialogOpen}
//         />
//       )}
//       <Table className="w-full">
//         <TableHeader>
//           <TableRow>
//             <TableHead>
//               <div className="flex items-center gap-4">
//                 <Checkbox
//                   checked={
//                     products.length > 0 && selectedProductIds.length === products.length
//                       ? true
//                       : selectedProductIds.length > 0
//                       ? 'indeterminate'
//                       : false
//                   }
//                   onCheckedChange={handleSelectAll}
//                 />
//                 Product
//               </div>
//             </TableHead>
//             <TableHead>Categories</TableHead>
//             <TableHead>Price</TableHead>
//             <TableHead>Stock</TableHead>
//             <TableHead>Upsells</TableHead>
//             <TableHead>Status</TableHead>
//             <TableHead>Actions</TableHead>
//           </TableRow>
//         </TableHeader>
//         <TableBody>
//           {products.length > 0 ? (
//             products.map((product) => (
//               <TableRow key={product.id}>
//                 <TableCell className="font-semibold">
//                   <div className="flex items-center gap-4">
//                     <Checkbox
//                       checked={selectedProductIds.includes(product.id)}
//                       onCheckedChange={() => handleSelect(product.id)}
//                     />
//                     <div className="flex items-center gap-3">
//                       <div className="min-w-[40px] min-h-[40px] flex items-center justify-center max-w-[40px] max-h-[40px] overflow-clip rounded-md border">
//                         <Image
//                           src={product.imgUrl}
//                           alt={product.name}
//                           width={30}
//                           height={30}
//                           className="object-cover h-full w-full"
//                         />
//                       </div>
//                       <div>
//                         <div>{product.name}</div>
//                         <div className="text-sm text-zinc-500 font-normal">
//                           {product.shortDescription}
//                         </div>
//                       </div>
//                     </div>
//                   </div>
//                 </TableCell>
//                 <TableCell>
//                   <div className="flex items-center gap-1 flex-wrap max-w-[250px]">
//                     {product.categories.length === 0 && (
//                       <div className="text-xs text-zinc-500">No categories</div>
//                     )}
//                     {product.categories
//                       .toSorted((a, b) => a.name.localeCompare(b.name))
//                       .slice(0, 2)
//                       .map((category) => (
//                         <Badge key={category.id} variant="outline" className="text-xs">
//                           {category.name}
//                         </Badge>
//                       ))}
//                     {product.categories.length > 2 && (
//                       <Tooltip>
//                         <TooltipTrigger asChild>
//                           <Badge variant="outline">+{product.categories.length - 2}</Badge>
//                         </TooltipTrigger>
//                         <TooltipContent>
//                           {product.categories
//                             .toSorted((a, b) => a.name.localeCompare(b.name))
//                             .slice(2)
//                             .map((category) => category.name)
//                             .join(', ')}
//                         </TooltipContent>
//                       </Tooltip>
//                     )}
//                   </div>
//                 </TableCell>
//                 <TableCell>
//                   {product.price.toLocaleString('en-US', {
//                     style: 'currency',
//                     currency: 'USD'
//                   })}
//                 </TableCell>

//                 <TableCell>
//                   {product.stock.length > 0 ? (
//                     <div
//                       className={cn(
//                         'text-xs',
//                         product.stock.reduce((acc, curr) => acc + (curr.value ?? 0), 0) > 0
//                           ? 'text-blue-800'
//                           : 'text-orange-700'
//                       )}
//                     >
//                       {product.stock.reduce((acc, curr) => acc + (curr.value ?? 0), 0)}{' '}
//                       available in {product.stock.length} locations
//                     </div>
//                   ) : (
//                     <div className="text-xs text-zinc-500">No stock set</div>
//                   )}
//                 </TableCell>
//                 <TableCell>
//                   {product.upsellProducts.length > 0 ? (
//                     <Tooltip>
//                       <TooltipTrigger asChild>
//                         <Badge variant="outline">
//                           {product.upsellProducts.length} cross-sells
//                         </Badge>
//                       </TooltipTrigger>
//                       <TooltipContent>
//                         {product.upsellProducts.map((product) => product.name).join(', ')}
//                       </TooltipContent>
//                     </Tooltip>
//                   ) : (
//                     <Badge variant="secondary">None</Badge>
//                   )}
//                 </TableCell>
//                 <TableCell>
//                   <div className="flex flex-wrap gap-2 max-w-[300px]">
//                     <ActiveStatusBadge active={product.active ? 'active' : 'inactive'} />
//                   </div>
//                 </TableCell>
//                 <TableCell>
//                   <DropdownMenu>
//                     <DropdownMenuTrigger
//                       className={buttonVariants({ variant: 'outline', size: 'icon-sm' })}
//                     >
//                       <Icon icon="ph:dots-three" />
//                     </DropdownMenuTrigger>
//                     <DropdownMenuContent>
//                       <DropdownMenuItem onClick={() => handleEditProduct(product)}>
//                         <Icon icon="ph:pencil-simple" />
//                         Edit Product
//                       </DropdownMenuItem>
//                       <DropdownMenuItem onClick={() => handleEditProductStock(product)}>
//                         <Icon icon="ph:package" />
//                         Manage Stock
//                       </DropdownMenuItem>
//                       <DropdownMenuItem onClick={() => handleActivateProduct(product)}>
//                         {product.active ? (
//                           <>
//                             <Icon icon="ph:prohibit" className="text-destructive" />
//                             <span className="text-destructive hover:text-destructive">
//                               Deactivate Product
//                             </span>
//                           </>
//                         ) : (
//                           <>
//                             <Icon icon="ph:check-circle" className="text-emerald-500 size-4" />
//                             <span className="text-emerald-500 hover:text-emerald-500">
//                               Activate Product
//                             </span>
//                           </>
//                         )}
//                       </DropdownMenuItem>
//                     </DropdownMenuContent>
//                   </DropdownMenu>
//                 </TableCell>
//               </TableRow>
//             ))
//           ) : (
//             <TableRow>
//               <TableCell colSpan={7} className="text-center">
//                 <p className="text-sm text-muted-foreground py-4">No products found</p>
//               </TableCell>
//             </TableRow>
//           )}
//         </TableBody>
//       </Table>

//       <PaginationController
//         className="mt-4"
//         totalPages={pagination.totalPages}
//         total={pagination.total}
//         currentPage={pagination.currentPage}
//       />
//     </>
//   );
// }

// export { ProductsTable };
