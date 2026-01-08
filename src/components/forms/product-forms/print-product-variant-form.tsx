"use client";

import { FSConnectedBadge } from "@/components/badges/fs-connected-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogHeader,
  DialogTrigger,
  DialogContent,
  DialogTitle,
  DialogFooter,
  DialogClose,
} from "@/components/ui/dialog";
import { Kbd } from "@/components/ui/kbd";
import { Switch } from "@/components/ui/switch";
import { useLocalServer } from "@/lib/hooks/use-local-server";
import { PrintProductSchema } from "@/lib/schemas/product-schema";
import { PrintProductResponse } from "@/lib/types/api";
import { cn, getProductDetailsForARXP, standardizePrintOrder } from "@/lib/utils";
import { blanks, blankVariants, prints, products, productVariants } from "@drizzle/schema";
import { Icon } from "@iconify/react";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ButtonProps } from "react-day-picker";
import { toast } from "sonner";

type Print = typeof prints.$inferSelect;

type PrintProductVariantFormProps = {
  productVariant: typeof productVariants.$inferSelect | undefined | null;
  blankVariant: typeof blankVariants.$inferSelect | undefined | null;
  blank: typeof blanks.$inferSelect | undefined | null;
  product: typeof products.$inferSelect | undefined | null;
  prints: Print[];
};

export const PrintProductVariantForm = ({
  productVariant,
  blankVariant,
  blank,
  product,
  prints,
}: PrintProductVariantFormProps) => {
  const { isConnected, config, checkFileExists, openFile } = useLocalServer();
  const [fileExists, setFileExists] = useState<boolean | null>(null);
  const [selectedPrint, setSelectedPrint] = useState<Print | null>(null);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [reduceStock, setReduceStock] = useState(true);

  const mutation = useMutation({
    mutationFn: async (input: PrintProductSchema) => {
      const res = await fetch(`/api/products/print`, {
        method: "POST",
        body: JSON.stringify(input),
      });
      const data = (await res.json()) as PrintProductResponse;

      if (!res.ok || data.error) {
        throw new Error(data.error ?? "Failed to print product");
      }

      return data;
    },
    onSuccess: () => {
      toast.success("Product printed. Stock reduced by 1.");
    },
    onError: (error) => {
      toast.error(error.message);
    },
  });

  const standardizedPrints = standardizePrintOrder(prints);

  const arxpDetails = useMemo(() => {
    const printIndex = selectedPrint ? standardizedPrints.findIndex((print) => print.id === selectedPrint.id) : -1;
    if (printIndex === -1) return null;
    return product && productVariant ? getProductDetailsForARXP(product, productVariant, printIndex) : null;
  }, [selectedPrint, product, productVariant, standardizedPrints]);

  // Consolidated print readiness state
  const printState = useMemo(() => {
    const isBlackLabel = product?.isBlackLabel ?? false;
    const hasProductVariant = !!productVariant;
    const hasBlankVariant = !!blankVariant;
    const hasBlank = !!blank?.id;
    const hasPrintSelected = !!selectedPrint;
    const hasArxpDetails = !!arxpDetails?.path;
    const hasArxpFolderPath = !!config.arxpFolderPath;
    const fileFound = fileExists === true;
    const hasStock = (blankVariant?.quantity ?? 0) > 0;

    const canPrint =
      !isBlackLabel &&
      hasProductVariant &&
      hasBlankVariant &&
      hasBlank &&
      hasPrintSelected &&
      hasArxpDetails &&
      hasArxpFolderPath &&
      isConnected &&
      fileFound;

    return {
      isBlackLabel,
      hasProductVariant,
      hasBlankVariant,
      hasBlank,
      hasPrintSelected,
      hasArxpDetails,
      hasArxpFolderPath,
      isConnected,
      fileFound,
      fileChecked: fileExists !== null,
      hasStock,
      canPrint,
    };
  }, [
    product,
    productVariant,
    blankVariant,
    blank,
    selectedPrint,
    arxpDetails,
    config.arxpFolderPath,
    isConnected,
    fileExists,
  ]);

  useEffect(() => {
    const verifyFile = async () => {
      if (!arxpDetails || !config.arxpFolderPath || !isConnected) {
        setFileExists(null);
        return;
      }

      try {
        const basePath = config.arxpFolderPath.replace(/\/$/, "");
        const fullPath = `${basePath}/${arxpDetails.path}`;
        const exists = await checkFileExists(fullPath);
        setFileExists(exists);
      } catch (e) {
        console.error("Failed to check file existence", e);
        setFileExists(false);
      }
    };

    verifyFile();
  }, [arxpDetails, config.arxpFolderPath, isConnected, checkFileExists]);

  const printFile = async () => {
    if (!printState.canPrint || !arxpDetails?.path || !productVariant?.id) return;

    const basePath = config.arxpFolderPath!.replace(/\/$/, "");
    const fullPath = `${basePath}/${arxpDetails.path}`;

    setIsPrinting(true);
    const openFileResult = await openFile(fullPath);

    if (openFileResult === "success") {
      // Only reduce stock if there's inventory AND user wants to reduce
      if (printState.hasStock && reduceStock) {
        mutation.mutate({ product_variant_id: productVariant.id, reason: "manual_print" });
      } else {
        toast.success("File opened.");
      }
      setIsDialogOpen(false);
    } else {
      toast.error("Failed to open file");
    }
    setIsPrinting(false);
  };

  // Show "ready to print" or blocking reason
  const renderPrintReadiness = () => {
    const { hasBlankVariant, hasPrintSelected, hasArxpFolderPath, fileFound, fileChecked } = printState;

    // Only show these when connected and has blank variant (main workflow)
    if (!isConnected || !hasBlankVariant) return null;

    if (!hasArxpFolderPath) {
      return (
        <Alert variant="destructive">
          <Icon icon="ph:folder-notch-open" />
          <AlertTitle>ARXP folder path not configured</AlertTitle>
          <AlertDescription>
            Please configure your ARXP folder path in{" "}
            <Link href="/profile" className="underline font-medium">
              settings
            </Link>{" "}
            to enable printing.
          </AlertDescription>
        </Alert>
      );
    }

    if (!hasPrintSelected) {
      return (
        <Alert variant="default" className="border-amber-200 bg-amber-50 text-amber-800">
          <Icon icon="ph:hand-pointing" />
          <AlertTitle>Select a print location</AlertTitle>
          <AlertDescription>Choose which print (Front, Back, etc.) you want to open above.</AlertDescription>
        </Alert>
      );
    }

    if (fileChecked && !fileFound) {
      return (
        <Alert variant="destructive">
          <Icon icon="ph:file-x" />
          <AlertTitle>File not found</AlertTitle>
          <AlertDescription>
            The ARXP file does not exist at the expected path. Verify the file exists or check your folder
            configuration.
          </AlertDescription>
        </Alert>
      );
    }

    return null;
  };

  return (
    <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
      <DialogTrigger asChild>
        <Button variant="fill" size="icon">
          <Icon icon="ph:printer" />
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            Print {product?.title}: {productVariant?.title ?? "???"}
          </DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          {printState.isBlackLabel ? (
            <Alert variant="default" className="text-indigo-600">
              <Icon icon="ph:info" />
              <AlertTitle>Black label product</AlertTitle>
              <AlertDescription>
                This product is a premade, "black label" product. It is not synced to a blank. You cannot print this
                product.
              </AlertDescription>
            </Alert>
          ) : (
            <>
              {!printState.hasBlankVariant && (
                <Alert variant="destructive">
                  <Icon icon="ph:warning-circle" />
                  <AlertTitle>
                    No blank synced for {product?.title}: {productVariant?.title}.
                  </AlertTitle>
                  <AlertDescription>
                    You cannot print products that do not specify a blank. Please sync the variant on the product page.
                  </AlertDescription>
                </Alert>
              )}

              {!printState.hasProductVariant && (
                <Alert variant="destructive">
                  <Icon icon="ph:warning-circle" />
                  <AlertTitle>Couldn't find variant in database. Contact dev.</AlertTitle>
                  <AlertDescription>Weird error 🫠</AlertDescription>
                </Alert>
              )}

              {!printState.isConnected && (
                <Alert variant="destructive">
                  <Icon icon="ph:wifi-slash" />
                  <AlertTitle>Not connected to file opener</AlertTitle>
                  <AlertDescription>
                    The local file server is not running or the config is incorrect.{" "}
                    <Link href="/profile" className="underline font-medium">
                      Check settings
                    </Link>
                  </AlertDescription>
                </Alert>
              )}

              {printState.isConnected && printState.hasBlankVariant && (
                <div className="flex flex-col gap-4">
                  {/* Print location selector grid */}
                  <div
                    className={cn(
                      "grid grid-cols-2 gap-2",
                      (() => {
                        const printCount = standardizedPrints.length;
                        const emptyBoxesNeeded = printCount === 1 || printCount === 3 ? 1 : 0;
                        const totalSlots = printCount + emptyBoxesNeeded;
                        return totalSlots <= 2 ? "grid-rows-1" : "grid-rows-2";
                      })()
                    )}
                  >
                    {(() => {
                      const printCount = standardizedPrints.length;
                      const emptyBoxesNeeded = printCount === 1 || printCount === 3 ? 1 : 0;
                      const totalSlots = printCount + emptyBoxesNeeded;

                      return Array.from({ length: totalSlots }, (_, index) => {
                        if (index < printCount) {
                          const print = standardizedPrints[index];
                          return (
                            <PrintSelector
                              className="h-18"
                              key={print.id}
                              print={{ ...print, printNumber: index + 1 }}
                              isSelected={selectedPrint?.id === print.id}
                              onClick={() => {
                                setSelectedPrint(selectedPrint?.id === print.id ? null : print);
                              }}
                            />
                          );
                        }
                        return (
                          <div
                            key={`empty-${index}`}
                            className="w-full h-18 bg-zinc-200 rounded-md border border-zinc-300"
                          />
                        );
                      });
                    })()}
                  </div>

                  {/* File details panel */}
                  <div
                    className={cn(
                      "bg-zinc-50 rounded-lg p-4 text-sm flex",
                      !arxpDetails && "items-center justify-center min-h-24"
                    )}
                  >
                    {arxpDetails ? (
                      <div className="space-y-1">
                        <div>
                          <span className="font-semibold">Base Name:</span> {arxpDetails.baseName}
                        </div>
                        <div>
                          <span className="font-semibold">Color:</span> {arxpDetails.color}
                        </div>
                        <div>
                          <span className="font-semibold">Size:</span> {arxpDetails.size}
                        </div>
                        <div className="flex flex-col gap-1 pt-1">
                          <span className="font-semibold">File Path:</span>
                          <Kbd>{config.arxpFolderPath}</Kbd>
                          <div className="flex items-center gap-1">
                            <Kbd>{arxpDetails.path}</Kbd>
                            {fileExists === null ? (
                              <Badge variant="secondary" className="py-0.5">
                                <div className="size-1 bg-zinc-400 rounded-full animate-pulse" />
                                Checking...
                              </Badge>
                            ) : fileExists ? (
                              <Badge variant="secondary" className="py-0.5 bg-emerald-50 text-emerald-700">
                                <div className="size-1 bg-emerald-600 rounded-full" />
                                File exists
                              </Badge>
                            ) : (
                              <Badge variant="secondary" className="py-0.5 bg-red-50 text-red-700">
                                <div className="size-1 bg-red-600 rounded-full" />
                                Not found
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="text-zinc-500">Select a print location above</div>
                    )}
                  </div>

                  {/* Print readiness alerts */}
                  {renderPrintReadiness()}

                  {/* Stock reduction toggle - only show when ready to print */}
                  {printState.canPrint && blank && (
                    <>
                      {!printState.hasStock && (
                        <Alert variant="destructive">
                          <Icon icon="ph:warning-circle" />
                          <AlertTitle>Out of stock</AlertTitle>
                          <AlertDescription>
                            {blank.blankCompany} {blank.blankName} - {blankVariant?.color} - {blankVariant?.size} has 0
                            inventory. You can still print, but stock reduction is disabled. Please ensure you know what
                            you're printing on and inventory is accounted for.
                          </AlertDescription>
                        </Alert>
                      )}
                      <Alert variant="default">
                        <AlertTitle>
                          <div className="flex items-center space-x-2">
                            <Switch
                              id="reduce-stock"
                              checked={printState.hasStock && reduceStock}
                              onCheckedChange={setReduceStock}
                              disabled={!printState.hasStock}
                            />
                            <span className={cn(!printState.hasStock && "text-zinc-400")}>
                              {printState.hasStock && reduceStock ? "Print and reduce stock" : "Print only"}
                            </span>
                          </div>
                        </AlertTitle>
                        <AlertDescription className="min-h-12">
                          {printState.hasStock && reduceStock ? (
                            <p>
                              {blank.blankCompany} {blank.blankName} - {blankVariant?.color} - {blankVariant?.size} will
                              be reduced by 1 (current: {blankVariant?.quantity}).
                            </p>
                          ) : printState.hasStock ? (
                            <p className="text-amber-600">
                              Printing will not reduce stock. Ensure this is intentional.
                            </p>
                          ) : (
                            <p className="text-zinc-500">Stock reduction unavailable — no inventory to reduce.</p>
                          )}
                        </AlertDescription>
                      </Alert>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </div>
        <DialogFooter className="flex justify-between! items-center">
          <FSConnectedBadge status={isConnected} />
          <div className="flex items-center gap-2">
            <DialogClose asChild>
              <Button variant="outline">Cancel</Button>
            </DialogClose>

            <Button onClick={printFile} disabled={!printState.canPrint} loading={isPrinting || mutation.isPending}>
              Open File & Print
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const PrintSelector = ({
  print,
  className,
  isSelected,
  ...props
}: {
  className?: string;
  print: Print & { printNumber: number };
  isSelected: boolean;
} & ButtonProps) => {
  return (
    <Button
      variant="outline"
      className={cn(
        "w-full h-full border-2 flex-col items-center justify-center gap-1!",
        isSelected && "border-blue-500! border-4! transition-all",
        className
      )}
      {...props}
    >
      <div>Print: {print.printNumber}</div>
      <div>Location: {print.location}</div>
      {print.heatTransferCode && <Badge variant="default">{print.heatTransferCode}</Badge>}
    </Button>
  );
};
