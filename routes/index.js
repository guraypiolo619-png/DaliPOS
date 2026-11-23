
  /*
    MIT License
    
    Copyright (c) 2025 Christian I. Cabrera || XianFire Framework
    Mindoro State University - Philippines

    Permission is hereby granted, free of charge, to any person obtaining a copy
    of this software and associated documentation files (the "Software"), to deal
    in the Software without restriction, including without limitation the rights
    to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
    copies of the Software, and to permit persons to whom the Software is
    furnished to do so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.
    */
    
import express from "express";
import { asyncHandler } from "../middleware/asyncHandler.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { requireIntegrationToken } from "../middleware/integrationAuth.js";
import { requireAdminApi } from "../middleware/adminApiAuth.js";
import { uploadProductImage, uploadProductImages } from "../middleware/productImageUpload.js";
import {
  daliAuditComplaintReferral,
  daliAuditHealth,
  daliAuditInspections,
  daliAuditPage,
  daliAuditReport,
  daliAuditStores,
} from "../controllers/daliAuditController.js";
import {
  integrationHealth,
  integrationInventory,
  integrationProducts,
  integrationSales,
} from "../controllers/integrationController.js";
import { login, loginPage, logout } from "../controllers/authController.js";
import { dashboard, homePage } from "../controllers/homeController.js";
import {
  createCategory,
  createProduct,
  deactivateProduct,
  productList,
  updateAllProducts,
  updateProduct,
} from "../controllers/productController.js";
import { checkout, posPage, salesList, salesReceipt } from "../controllers/posController.js";
import { createUser, toggleUser, updateUser, userList } from "../controllers/userController.js";
import { activityLogs, stockHistory } from "../controllers/auditController.js";
import {
  cancelPurchaseOrder,
  createPurchaseOrder,
  createSupplier,
  purchaseOrdersPage,
  receivePurchaseOrder,
  toggleSupplier,
  updateSupplier,
} from "../controllers/purchaseOrderController.js";

const router = express.Router();
router.get("/admin/daliaudit", requireRole("admin"), asyncHandler(daliAuditPage));
router.get("/api/integration/v1/daliaudit/health", requireAdminApi, asyncHandler(daliAuditHealth));
router.get("/api/integration/v1/daliaudit/stores", requireAdminApi, asyncHandler(daliAuditStores));
router.get("/api/integration/v1/daliaudit/inspections", requireAdminApi, asyncHandler(daliAuditInspections));
router.get("/api/integration/v1/daliaudit/reports/:reportCode", requireAdminApi, asyncHandler(daliAuditReport));
router.post("/api/integration/v1/daliaudit/complaints/referral", requireAdminApi, asyncHandler(daliAuditComplaintReferral));

router.get("/api/integration/v1/health", requireIntegrationToken, asyncHandler(integrationHealth));
router.get("/api/integration/v1/products", requireIntegrationToken, asyncHandler(integrationProducts));
router.get("/api/integration/v1/inventory", requireIntegrationToken, asyncHandler(integrationInventory));
router.get("/api/integration/v1/sales", requireIntegrationToken, asyncHandler(integrationSales));

router.get("/", homePage);
router.get("/login", loginPage);
router.post("/login", asyncHandler(login));
router.post("/logout", asyncHandler(logout));

router.get("/dashboard", requireRole("admin", "staff"), asyncHandler(dashboard));
router.get("/pos", requireAuth, asyncHandler(posPage));
router.post("/pos/checkout", requireAuth, asyncHandler(checkout));
router.get("/sales", requireRole("admin"), asyncHandler(salesList));
router.get("/sales/:id/receipt", requireAuth, asyncHandler(salesReceipt));

router.get("/admin/products", requireRole("admin"), asyncHandler(productList));
router.get("/admin/stock-history", requireRole("admin"), asyncHandler(stockHistory));
router.get("/admin/activity-logs", requireRole("admin"), asyncHandler(activityLogs));
router.get("/admin/purchase-orders", requireRole("admin"), asyncHandler(purchaseOrdersPage));
router.post("/admin/suppliers", requireRole("admin"), asyncHandler(createSupplier));
router.post("/admin/suppliers/:id/update", requireRole("admin"), asyncHandler(updateSupplier));
router.post("/admin/suppliers/:id/toggle", requireRole("admin"), asyncHandler(toggleSupplier));
router.post("/admin/purchase-orders", requireRole("admin"), asyncHandler(createPurchaseOrder));
router.post("/admin/purchase-orders/:id/receive", requireRole("admin"), asyncHandler(receivePurchaseOrder));
router.post("/admin/purchase-orders/:id/cancel", requireRole("admin"), asyncHandler(cancelPurchaseOrder));
router.post("/admin/products", requireRole("admin"), uploadProductImage, asyncHandler(createProduct));
router.post("/admin/products/:id/update", requireRole("admin"), uploadProductImage, asyncHandler(updateProduct));
router.post("/admin/products/update-all", requireRole("admin"), uploadProductImages, asyncHandler(updateAllProducts));
router.post("/admin/products/:id/deactivate", requireRole("admin"), asyncHandler(deactivateProduct));
router.post("/admin/categories", requireRole("admin"), asyncHandler(createCategory));

router.get("/admin/users", requireRole("admin"), asyncHandler(userList));
router.post("/admin/users", requireRole("admin"), asyncHandler(createUser));
router.post("/admin/users/:id/update", requireRole("admin"), asyncHandler(updateUser));
router.post("/admin/users/:id/toggle", requireRole("admin"), asyncHandler(toggleUser));

export default router;
