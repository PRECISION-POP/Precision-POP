import { useBrand } from "@/contexts/BrandContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { CheckCircle2, Plus, Trash2, Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GroceryBrandForm } from "@/components/GroceryBrandForm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface Retailer {
  id?: string;
  retailer_id: string;
  name: string;
  logo_url: string;
  primary_color: string;
  city?: string;
  state?: string;
  website?: string;
  tagline?: string;
  is_active?: boolean;
}

const GroceryAdmin = () => {
  const { currentBrand, allBrands, setActiveBrand, isLoading, isSwitchingBrand, refreshBrands } = useBrand();
  const [isAddingBrand, setIsAddingBrand] = useState(false);
  const [editingBrandId, setEditingBrandId] = useState<string | null>(null);
  const [editedBrand, setEditedBrand] = useState<Retailer | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  // ---- admin gate: PIN from env, session-persisted unlock, fail-closed ----
  const [pinInput, setPinInput] = useState("");
  const [unlocked, setUnlocked] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem("ppop_admin_unlocked") === "1";
    } catch {
      return false;
    }
  });
  const adminPin = import.meta.env.VITE_ADMIN_PIN as string | undefined;

  const tryUnlock = () => {
    if (adminPin && pinInput === adminPin) {
      setUnlocked(true);
      try {
        sessionStorage.setItem("ppop_admin_unlocked", "1");
      } catch {
        /* ignore */
      }
    } else {
      toast.error("Incorrect PIN");
    }
    setPinInput("");
  };
  const [newBrand, setNewBrand] = useState<Omit<Retailer, "id">>({
    retailer_id: "",
    name: "",
    logo_url: "",
    primary_color: "142 71% 45%",
    city: "",
    state: "",
    website: "",
    tagline: "",
  });

  const filteredBrands = useMemo(() => {
    return allBrands
      .filter(
        (brand) =>
          searchTerm === "" ||
          brand.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          brand.retailer_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
          brand.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
          brand.state?.toLowerCase().includes(searchTerm.toLowerCase()),
      )
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [allBrands, searchTerm]);

  const validateBrand = (brand: Partial<Retailer>): Record<string, string> => {
    const errors: Record<string, string> = {};

    if (!brand.retailer_id) {
      errors.retailer_id = "Retailer ID is required";
    } else if (!/^[a-z0-9-]+$/.test(brand.retailer_id)) {
      errors.retailer_id = "Must be lowercase alphanumeric with hyphens";
    }

    if (!brand.name || brand.name.length < 2) {
      errors.name = "Name must be at least 2 characters";
    }

    if (brand.website && !brand.website.startsWith("http")) {
      errors.website = "Must start with http:// or https://";
    }

    if (!brand.logo_url) errors.logo_url = "Logo is required";

    return errors;
  };

  const handleBrandSwitch = async (retailerId: string) => {
    await setActiveBrand(retailerId);
  };

  const handleImageUpload = async (file: File, field: "logo_url", retailerId: string): Promise<string | null> => {
    try {
      if (!retailerId) {
        toast.error("Please enter a Retailer ID first");
        return null;
      }

      const fileExt = file.name.split(".").pop();
      const fileName = `${retailerId}-${field}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError } = await supabase.storage.from("brand-images").upload(filePath, file, {
        cacheControl: "3600",
        upsert: false,
      });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("brand-images").getPublicUrl(filePath);

      toast.success(`${field.replace("_", " ")} uploaded successfully!`);
      return publicUrl;
    } catch (error: any) {
      console.error("Upload error:", error);
      toast.error(`Upload failed: ${error.message}`);
      return null;
    }
  };

  const handleAddBrand = async () => {
    const errors = validateBrand(newBrand);

    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error("Please fix the errors before saving");
      return;
    }

    setFormErrors({});
    setIsSaving(true);
    try {
      const { error } = await supabase.from("retailers").insert([newBrand]);

      if (error) {
        if (error.code === "23505") {
          toast.error("A retailer with this ID already exists");
        } else {
          toast.error(`Database error: ${error.message}`);
        }
        setIsSaving(false);
        return;
      }

      await refreshBrands();
      await new Promise((resolve) => setTimeout(resolve, 200));

      toast.success("Grocery brand added successfully!");

      setIsAddingBrand(false);
      setNewBrand({
        retailer_id: "",
        name: "",
        logo_url: "",
        primary_color: "142 71% 45%",
        city: "",
        state: "",
        website: "",
        tagline: "",
      });
    } catch (err: any) {
      console.error("Add brand error:", err);
      toast.error(`Unexpected error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditBrand = (brand: any) => {
    console.log("🎬 handleEditBrand called with brand:", brand);
    console.log("🎬 brand.id:", brand.id);
    console.log("🎬 typeof brand.id:", typeof brand.id);

    if (!brand.id) {
      console.error("❌ Brand has no ID!");
      toast.error("Error: Brand ID is missing");
      return;
    }

    setEditingBrandId(brand.id);
    setEditedBrand({ ...brand });
  };

  const handleSaveEdit = async () => {
    console.log("🔧 handleSaveEdit CALLED");
    console.log("🔧 editedBrand:", editedBrand);
    console.log("🔧 editedBrand?.id:", editedBrand?.id);
    console.log("🔧 typeof editedBrand?.id:", typeof editedBrand?.id);

    if (!editedBrand) {
      console.error("❌ No editedBrand");
      return;
    }

    if (!editedBrand.id) {
      console.error("❌ editedBrand has no ID!");
      toast.error("Error: Cannot update - brand ID is missing");
      return;
    }

    const errors = validateBrand(editedBrand);
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      toast.error("Please fix the errors before saving");
      return;
    }

    setFormErrors({});
    setIsSaving(true);

    try {
      const updateData = {
        name: editedBrand.name,
        logo_url: editedBrand.logo_url,
        primary_color: editedBrand.primary_color,
        city: editedBrand.city || "",
        state: editedBrand.state || "",
        website: editedBrand.website || "",
        tagline: editedBrand.tagline || "",
      };

      console.log("📝 Updating brand with ID:", editedBrand.id);
      console.log("📝 Update data:", updateData);

      const { data, error } = await supabase.from("retailers").update(updateData).eq("id", editedBrand.id).select();

      console.log("📝 Update response data:", data);
      console.log("📝 Update response error:", error);

      if (error) {
        console.error("❌ Update error:", error);
        toast.error(`Database error: ${error.message}`);
        setIsSaving(false);
        return;
      }

      if (!data || data.length === 0) {
        console.error("❌ Update returned no data - ID might not exist in database");
        toast.error("Failed to update: Brand not found in database");
        setIsSaving(false);
        return;
      }

      console.log("✅ Update successful, returned data:", data);
      console.log("🔧 About to call refreshBrands()");

      await refreshBrands();

      console.log("🔧 refreshBrands() COMPLETED");
      await new Promise((resolve) => setTimeout(resolve, 200));

      toast.success("Grocery brand updated successfully!");

      setEditingBrandId(null);
      setEditedBrand(null);
    } catch (err: any) {
      console.error("❌ Unexpected error in handleSaveEdit:", err);
      toast.error(`Unexpected error: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteBrand = async (brandId: string) => {
    setIsDeleting(true);
    try {
      const { error } = await supabase.from("retailers").delete().eq("id", brandId);

      if (error) {
        toast.error(`Delete failed: ${error.message}`);
        setIsDeleting(false);
        return;
      }

      await refreshBrands();
      await new Promise((resolve) => setTimeout(resolve, 200));

      toast.success("Grocery brand deleted successfully!");
      setDeleteConfirm(null);
    } catch (err: any) {
      console.error("Delete error:", err);
      toast.error(`Unexpected error: ${err.message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-white mx-auto mb-4" />
          <p className="text-white text-xl">Loading grocery brands...</p>
        </div>
      </div>
    );
  }

  // Fail-closed admin gate: no PIN configured => no access. Set VITE_ADMIN_PIN
  // at build time (Cloudflare Workers Builds env var) to enable for demos.
  if (!unlocked) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center p-8">
        <div className="max-w-sm w-full text-center">
          <h1 className="text-2xl font-bold text-white mb-2">Restricted area</h1>
          <p className="text-gray-400 text-sm mb-6">
            {adminPin
              ? "Enter the admin PIN to manage grocery brands."
              : "Admin access is not configured for this deployment."}
          </p>
          {adminPin && (
            <div className="flex gap-2">
              <Input
                type="password"
                inputMode="numeric"
                placeholder="Admin PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && tryUnlock()}
                className="bg-gray-800 border-gray-700 text-white"
              />
              <Button onClick={tryUnlock} className="bg-green-600 hover:bg-green-700">
                Unlock
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 p-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">Grocery Brand Management</h1>
              <p className="text-gray-400">Manage white-label grocery brands, logos, and colors</p>
            </div>
            <Button onClick={() => setIsAddingBrand(!isAddingBrand)} className="bg-green-600 hover:bg-green-700">
              <Plus className="w-4 h-4 mr-2" />
              Add New Grocer
            </Button>
          </div>

          <div className="mb-4">
            <Input
              placeholder="Search by name, ID, city, or state..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-md bg-gray-800 text-white border-gray-700"
            />
            {searchTerm && (
              <p className="text-sm text-gray-400 mt-2">
                Found {filteredBrands.length} {filteredBrands.length === 1 ? "brand" : "brands"}
              </p>
            )}
          </div>
        </div>

        {isAddingBrand && (
          <Card className="mb-8 bg-gray-800 border-green-600">
            <CardHeader>
              <CardTitle className="text-white">Add New Grocery Brand</CardTitle>
              <CardDescription className="text-gray-400">
                Configure logos, colors, and store information
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <GroceryBrandForm
                brand={newBrand}
                onChange={(updates) => {
                  setNewBrand((prev) => ({ ...prev, ...updates }));
                  const fieldKey = Object.keys(updates)[0];
                  if (fieldKey) {
                    setFormErrors((prev) => {
                      const next = { ...prev };
                      delete next[fieldKey];
                      return next;
                    });
                  }
                }}
                onImageUpload={handleImageUpload}
                errors={formErrors}
              />
              <div className="flex gap-4">
                <Button onClick={handleAddBrand} className="bg-green-600 hover:bg-green-700" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Grocery Brand
                    </>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setIsAddingBrand(false)} disabled={isSaving}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredBrands.map((brand) => {
            console.log("🎨 Rendering brand card:", { id: brand.id, name: brand.name });
            return (
              <Card
                key={brand.id}
                className={`bg-gray-800 border-2 ${brand.is_active ? "border-green-500" : "border-gray-700"}`}
              >
                <CardContent className="p-0">
                  <div className="relative h-48 bg-gray-900 rounded-t-lg overflow-hidden flex items-center justify-center">
                    <img
                      src={brand.logo_url}
                      alt={`${brand.name} logo`}
                      className="max-h-32 max-w-[80%] object-contain"
                    />
                    {brand.is_active && (
                      <Badge className="absolute top-3 right-3 bg-green-600">
                        <CheckCircle2 className="w-3 h-3 mr-1" />
                        Active
                      </Badge>
                    )}
                  </div>

                  <div className="p-4 space-y-3">
                    <div>
                      <h3 className="text-lg font-bold text-white">{brand.name}</h3>
                      <p className="text-xs text-gray-400">ID: {brand.retailer_id}</p>
                      {brand.city && brand.state && (
                        <p className="text-xs text-gray-400">
                          {brand.city}, {brand.state}
                        </p>
                      )}
                    </div>

                    <div>
                      <p className="text-xs text-gray-400 mb-2">Primary Color</p>
                      <div
                        className="w-full h-12 rounded-lg border border-gray-600"
                        style={{ backgroundColor: `hsl(${brand.primary_color})` }}
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={() => handleEditBrand(brand)}
                        variant="outline"
                        className="flex-1 bg-gray-700 hover:bg-gray-600 text-white border-gray-600"
                      >
                        Edit
                      </Button>
                      {!brand.is_active && (
                        <Button
                          onClick={() => handleBrandSwitch(brand.retailer_id)}
                          disabled={isSwitchingBrand}
                          className="flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                        >
                          {isSwitchingBrand ? (
                            <>
                              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                              Switching...
                            </>
                          ) : (
                            "Switch"
                          )}
                        </Button>
                      )}
                      <Button
                        variant="destructive"
                        size="icon"
                        onClick={() => setDeleteConfirm(brand.id || null)}
                        className="bg-red-500 hover:bg-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <Sheet
          open={!!editingBrandId}
          onOpenChange={() => {
            setEditingBrandId(null);
            setEditedBrand(null);
          }}
        >
          <SheetContent className="w-full sm:max-w-2xl overflow-y-auto bg-gray-800">
            <SheetHeader>
              <SheetTitle className="text-white">Edit Grocery Brand</SheetTitle>
            </SheetHeader>
            <div className="mt-6 space-y-6">
              {editedBrand && (
                <>
                  {editedBrand.logo_url && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-400 mb-2">Current Logo Preview:</p>
                      <div className="flex items-center justify-center p-6 bg-gray-700 rounded-lg border border-gray-600">
                        <img
                          src={editedBrand.logo_url}
                          alt={`${editedBrand.name} logo`}
                          className="h-20 object-contain"
                        />
                      </div>
                    </div>
                  )}
                  <GroceryBrandForm
                    brand={editedBrand}
                    onChange={(updates) => {
                      setEditedBrand((prev) => {
                        if (!prev) return prev;
                        return { ...prev, ...updates };
                      });
                      const fieldKey = Object.keys(updates)[0];
                      if (fieldKey) {
                        setFormErrors((prev) => {
                          const next = { ...prev };
                          delete next[fieldKey];
                          return next;
                        });
                      }
                    }}
                    onImageUpload={handleImageUpload}
                    isEdit={true}
                    errors={formErrors}
                  />
                </>
              )}
              <div className="flex gap-4">
                <Button onClick={handleSaveEdit} className="bg-green-600 hover:bg-green-700" disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setEditingBrandId(null);
                    setEditedBrand(null);
                  }}
                  disabled={isSaving}
                >
                  Cancel
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
          <AlertDialogContent className="bg-gray-800 border-gray-700">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-white">Delete Grocery Brand?</AlertDialogTitle>
              <AlertDialogDescription className="text-gray-400">
                This will permanently delete this grocery brand. This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => deleteConfirm && handleDeleteBrand(deleteConfirm)}
                className="bg-red-600 hover:bg-red-700"
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  "Delete"
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
};

export default GroceryAdmin;
