<?php
/**
 * AgriChain Buyer Backend
 * Handles all buyer-related operations including products, purchases, escrow, and wallet
 * Assumes config.php contains database connection initialization
 */

require_once 'config.php';

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE');
header('Access-Control-Allow-Headers: Content-Type');

class BuyerBackend {
    private $db;
    private $buyerId = '12345678-1234-1234-1234-123456789abc'; // Default buyer ID - In production, get from session

    public function __construct($db) {
        $this->db = $db;
    }

    /**
     * Get all available products with filtering and search
     */
    public function getProducts($filters = []) {
        try {
            $query = "SELECT * FROM products WHERE status = 'AVAILABLE' AND available_kg > 0";
            $params = [];

            // Apply filters
            if (!empty($filters['search'])) {
                $query .= " AND (product_name ILIKE $1 OR farmer_name ILIKE $1 OR location ILIKE $1)";
                $params[] = '%' . $filters['search'] . '%';
            }

            if (!empty($filters['crop_type']) && $filters['crop_type'] !== 'All Crops') {
                $query .= " AND product_type = $" . (count($params) + 1);
                $params[] = $filters['crop_type'];
            }

            if (!empty($filters['region']) && $filters['region'] !== 'Any Region') {
                $query .= " AND location ILIKE $" . (count($params) + 1);
                $params[] = '%' . $filters['region'] . '%';
            }

            if (!empty($filters['status']) && $filters['status'] !== 'Any Status') {
                if ($filters['status'] === 'Verified') {
                    $query .= " AND quality_rating = 'EXCELLENT'";
                } elseif ($filters['status'] === 'Organic') {
                    $query .= " AND product_type ILIKE '%organic%'";
                } elseif ($filters['status'] === 'Premium') {
                    $query .= " AND quality_rating IN ('EXCELLENT', 'PREMIUM')";
                }
            }

            $query .= " ORDER BY created_at DESC";
            
            $result = pg_query_params($this->db, $query, $params);
            
            if (!$result) {
                throw new Exception('Database query failed: ' . pg_last_error($this->db));
            }

            $products = [];
            while ($row = pg_fetch_assoc($result)) {
                $products[] = $row;
            }

            return ['success' => true, 'data' => $products];
        } catch (Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Get product provenance data
     */
    public function getProvenance($batchId) {
        try {
            $query = "SELECT provenance_data FROM products WHERE batch_id = $1";
            $result = pg_query_params($this->db, $query, [$batchId]);
            
            if (!$result) {
                throw new Exception('Database query failed');
            }

            $row = pg_fetch_assoc($result);
            if (!$row) {
                throw new Exception('Product not found');
            }

            $provenance = json_decode($row['provenance_data'], true) ?? [];
            
            return ['success' => true, 'data' => $provenance];
        } catch (Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Create a new purchase order
     */
    public function createPurchase($productId, $quantity, $deliveryAddress) {
        try {
            // Start transaction
            pg_query($this->db, "BEGIN");

            // Get product details
            $productQuery = "SELECT * FROM products WHERE id = $1 FOR UPDATE";
            $productResult = pg_query_params($this->db, $productQuery, [$productId]);
            $product = pg_fetch_assoc($productResult);

            if (!$product) {
                throw new Exception('Product not found');
            }

            if ($product['available_kg'] < $quantity) {
                throw new Exception('Insufficient quantity available');
            }

            $totalPrice = $product['price_hbar'] * $quantity;

            // Check buyer balance
            $balanceQuery = "SELECT hbar_balance FROM buyers WHERE id = $1";
            $balanceResult = pg_query_params($this->db, $balanceQuery, [$this->buyerId]);
            $buyer = pg_fetch_assoc($balanceResult);

            if ($buyer['hbar_balance'] < $totalPrice) {
                throw new Exception('Insufficient HBAR balance');
            }

            // Create purchase record
            $purchaseQuery = "INSERT INTO purchases (buyer_id, product_id, batch_id, quantity_kg, total_price, delivery_address, status) 
                             VALUES ($1, $2, $3, $4, $5, $6, 'PENDING') RETURNING id";
            $purchaseResult = pg_query_params($this->db, $purchaseQuery, [
                $this->buyerId, $productId, $product['batch_id'], $quantity, $totalPrice, $deliveryAddress
            ]);

            $purchase = pg_fetch_assoc($purchaseResult);
            $purchaseId = $purchase['id'];

            // Update product available quantity
            $updateProductQuery = "UPDATE products SET available_kg = available_kg - $1 WHERE id = $2";
            pg_query_params($this->db, $updateProductQuery, [$quantity, $productId]);

            // Create escrow transaction
            $escrowQuery = "INSERT INTO escrow_transactions (purchase_id, buyer_id, amount_hbar, escrow_address, status) 
                           VALUES ($1, $2, $3, $4, 'ACTIVE') RETURNING id";
            $escrowAddress = '0.0.' . rand(1000000, 9999999); // Generate mock escrow address
            pg_query_params($this->db, $escrowQuery, [$purchaseId, $this->buyerId, $totalPrice, $escrowAddress]);

            // Deduct from buyer balance
            $updateBalanceQuery = "UPDATE buyers SET hbar_balance = hbar_balance - $1 WHERE id = $2";
            pg_query_params($this->db, $updateBalanceQuery, [$totalPrice, $this->buyerId]);

            // Record wallet transaction
            $walletQuery = "INSERT INTO wallet_transactions (buyer_id, type, amount_hbar, recipient_address, description) 
                           VALUES ($1, 'ESCROW', $2, $3, $4)";
            $description = "Escrow payment for " . $product['product_name'] . " (Batch: " . $product['batch_id'] . ")";
            pg_query_params($this->db, $walletQuery, [$this->buyerId, $totalPrice, $escrowAddress, $description]);

            pg_query($this->db, "COMMIT");

            return ['success' => true, 'purchase_id' => $purchaseId, 'escrow_address' => $escrowAddress];
        } catch (Exception $e) {
            pg_query($this->db, "ROLLBACK");
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Get buyer's purchase history
     */
    public function getPurchases($filters = []) {
        try {
            $query = "SELECT p.*, pr.product_name, pr.farmer_name, pr.batch_id, pr.product_type 
                     FROM purchases p 
                     JOIN products pr ON p.product_id = pr.id 
                     WHERE p.buyer_id = $1";
            $params = [$this->buyerId];

            if (!empty($filters['status']) && $filters['status'] !== 'all') {
                $query .= " AND p.status = $" . (count($params) + 1);
                $params[] = strtoupper($filters['status']);
            }

            $query .= " ORDER BY p.created_at DESC";

            $result = pg_query_params($this->db, $query, $params);
            
            if (!$result) {
                throw new Exception('Database query failed');
            }

            $purchases = [];
            while ($row = pg_fetch_assoc($result)) {
                $purchases[] = $row;
            }

            return ['success' => true, 'data' => $purchases];
        } catch (Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Get escrow transactions for buyer
     */
    public function getEscrowTransactions($filters = []) {
        try {
            $query = "SELECT e.*, p.product_name, p.batch_id, pu.quantity_kg, pu.total_price 
                     FROM escrow_transactions e
                     JOIN purchases pu ON e.purchase_id = pu.id
                     JOIN products p ON pu.product_id = p.id
                     WHERE e.buyer_id = $1";
            $params = [$this->buyerId];

            if (!empty($filters['status']) && $filters['status'] !== 'all') {
                $query .= " AND e.status = $" . (count($params) + 1);
                $params[] = strtoupper($filters['status']);
            }

            $query .= " ORDER BY e.created_date DESC";

            $result = pg_query_params($this->db, $query, $params);
            
            if (!$result) {
                throw new Exception('Database query failed');
            }

            $escrows = [];
            while ($row = pg_fetch_assoc($result)) {
                $escrows[] = $row;
            }

            return ['success' => true, 'data' => $escrows];
        } catch (Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Release escrow funds to farmer
     */
    public function releaseEscrow($escrowId) {
        try {
            pg_query($this->db, "BEGIN");

            // Get escrow details
            $escrowQuery = "SELECT * FROM escrow_transactions WHERE id = $1 AND status = 'ACTIVE' FOR UPDATE";
            $escrowResult = pg_query_params($this->db, $escrowQuery, [$escrowId]);
            $escrow = pg_fetch_assoc($escrowResult);

            if (!$escrow) {
                throw new Exception('Escrow not found or already released');
            }

            // Update escrow status
            $updateEscrowQuery = "UPDATE escrow_transactions SET status = 'RELEASED', released_date = NOW() WHERE id = $1";
            pg_query_params($this->db, $updateEscrowQuery, [$escrowId]);

            // Update purchase status
            $updatePurchaseQuery = "UPDATE purchases SET status = 'COMPLETED', payment_status = 'PAID' WHERE id = $1";
            pg_query_params($this->db, $updatePurchaseQuery, [$escrow['purchase_id']]);

            pg_query($this->db, "COMMIT");

            return ['success' => true, 'message' => 'Funds released successfully'];
        } catch (Exception $e) {
            pg_query($this->db, "ROLLBACK");
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Get wallet balance and transactions
     */
    public function getWalletInfo() {
        try {
            // Get balance
            $balanceQuery = "SELECT hbar_balance, wallet_address FROM buyers WHERE id = $1";
            $balanceResult = pg_query_params($this->db, $balanceQuery, [$this->buyerId]);
            $balance = pg_fetch_assoc($balanceResult);

            // Get transactions
            $txQuery = "SELECT * FROM wallet_transactions WHERE buyer_id = $1 ORDER BY created_at DESC LIMIT 20";
            $txResult = pg_query_params($this->db, $txQuery, [$this->buyerId]);
            
            $transactions = [];
            while ($row = pg_fetch_assoc($txResult)) {
                $transactions[] = $row;
            }

            return [
                'success' => true, 
                'balance' => $balance['hbar_balance'],
                'wallet_address' => $balance['wallet_address'],
                'transactions' => $transactions
            ];
        } catch (Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }

    /**
     * Update buyer profile
     */
    public function updateProfile($profileData) {
        try {
            $query = "UPDATE buyers SET 
                     company_name = $1, contact_person = $2, email = $3, 
                     phone = $4, business_address = $5, business_type = $6,
                     updated_at = NOW() 
                     WHERE id = $7";
            
            $result = pg_query_params($this->db, $query, [
                $profileData['company_name'],
                $profileData['contact_person'],
                $profileData['email'],
                $profileData['phone'],
                $profileData['business_address'],
                $profileData['business_type'],
                $this->buyerId
            ]);

            if (!$result) {
                throw new Exception('Profile update failed');
            }

            return ['success' => true, 'message' => 'Profile updated successfully'];
        } catch (Exception $e) {
            return ['success' => false, 'error' => $e->getMessage()];
        }
    }
}

// Initialize backend and handle requests
$backend = new BuyerBackend($db);

// Get request method and action
$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';

// Route requests
switch ($action) {
    case 'get_products':
        $filters = [
            'search' => $_GET['search'] ?? '',
            'crop_type' => $_GET['crop_type'] ?? '',
            'region' => $_GET['region'] ?? '',
            'status' => $_GET['status'] ?? ''
        ];
        echo json_encode($backend->getProducts($filters));
        break;

    case 'get_provenance':
        $batchId = $_GET['batch_id'] ?? '';
        echo json_encode($backend->getProvenance($batchId));
        break;

    case 'create_purchase':
        if ($method === 'POST') {
            $data = json_decode(file_get_contents('php://input'), true);
            echo json_encode($backend->createPurchase(
                $data['product_id'],
                $data['quantity'],
                $data['delivery_address']
            ));
        }
        break;

    case 'get_purchases':
        $filters = ['status' => $_GET['status'] ?? 'all'];
        echo json_encode($backend->getPurchases($filters));
        break;

    case 'get_escrow':
        $filters = ['status' => $_GET['status'] ?? 'all'];
        echo json_encode($backend->getEscrowTransactions($filters));
        break;

    case 'release_escrow':
        if ($method === 'POST') {
            $data = json_decode(file_get_contents('php://input'), true);
            echo json_encode($backend->releaseEscrow($data['escrow_id']));
        }
        break;

    case 'get_wallet':
        echo json_encode($backend->getWalletInfo());
        break;

    case 'update_profile':
        if ($method === 'POST') {
            $data = json_decode(file_get_contents('php://input'), true);
            echo json_encode($backend->updateProfile($data));
        }
        break;

    default:
        echo json_encode(['success' => false, 'error' => 'Invalid action']);
        break;
}