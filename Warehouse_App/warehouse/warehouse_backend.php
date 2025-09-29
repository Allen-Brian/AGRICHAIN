<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With');

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(200);
    exit();
}

require_once 'config.php';

class WarehouseBackend {
    private $pdo;
    private $cacheDir = './cache/';
    private $offlineStorage = './offline_data/';
    
    public function __construct() {
        try {
            $this->pdo = new PDO(
                "pgsql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";port=" . DB_PORT,
                DB_USER,
                DB_PASS,
                [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]
            );
            
            // Create cache and offline directories if they don't exist
            if (!is_dir($this->cacheDir)) mkdir($this->cacheDir, 0755, true);
            if (!is_dir($this->offlineStorage)) mkdir($this->offlineStorage, 0755, true);
            
        } catch (PDOException $e) {
            error_log("Database connection failed: " . $e->getMessage());
            $this->sendResponse(['error' => 'Database connection failed. Please check configuration.'], 500);
        }
    }
    
    private function sendResponse($data, $statusCode = 200) {
        http_response_code($statusCode);
        echo json_encode($data);
        exit;
    }
    
    private function getCache($key, $maxAge = 300) {
        $cacheFile = $this->cacheDir . md5($key) . '.json';
        if (file_exists($cacheFile) && (time() - filemtime($cacheFile)) < $maxAge) {
            return json_decode(file_get_contents($cacheFile), true);
        }
        return null;
    }
    
    private function setCache($key, $data) {
        $cacheFile = $this->cacheDir . md5($key) . '.json';
        file_put_contents($cacheFile, json_encode($data));
    }
    
    private function clearCache($pattern) {
        $files = glob($this->cacheDir . '*');
        foreach ($files as $file) {
            if (strpos($file, $pattern) !== false || $pattern === 'all') {
                @unlink($file);
            }
        }
    }
    
    public function handleRequest() {
        $method = $_SERVER['REQUEST_METHOD'];
        $path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH);
        
        // Extract the endpoint path
        $basePath = '/warehouse_backend.php';
        if (strpos($path, $basePath) === 0) {
            $path = substr($path, strlen($basePath));
        }
        
        // Get input data
        $input = [];
        if ($method === 'POST' || $method === 'PUT') {
            $input = json_decode(file_get_contents('php://input'), true) ?? [];
        } else {
            $input = $_GET;
        }
        
        try {
            switch ($path) {
                case '/deliveries':
                    if ($method === 'GET') $this->getDeliveries($input);
                    break;
                    
                case '/deliveries/pending':
                    $this->getPendingDeliveries();
                    break;
                    
                case '/deliveries/confirm':
                    if ($method === 'POST') $this->confirmDelivery($input);
                    break;
                    
                case '/inventory':
                    $this->getInventory();
                    break;
                    
                case '/inspections':
                    if ($method === 'GET') $this->getInspections($input);
                    elseif ($method === 'POST') $this->createInspection($input);
                    break;
                    
                case '/inspections/history':
                    $this->getInspectionHistory();
                    break;
                    
                case '/reports/stats':
                    $this->getReportsStats($input);
                    break;
                    
                case '/scan/delivery':
                    if ($method === 'POST') $this->scanDelivery($input);
                    break;
                    
                case '/activity/logs':
                    $this->getActivityLogs($input);
                    break;
                    
                case '/export/pdf':
                    $this->exportPdf($input);
                    break;
                    
                case '/export/excel':
                    $this->exportExcel($input);
                    break;
                    
                case '/export/csv':
                    $this->exportCsv($input);
                    break;
                    
                case '/system/health':
                    $this->checkSystemHealth();
                    break;
                    
                default:
                    $this->sendResponse(['error' => 'Endpoint not found: ' . $path], 404);
            }
        } catch (Exception $e) {
            error_log("API Error: " . $e->getMessage());
            $this->sendResponse(['error' => 'Internal server error: ' . $e->getMessage()], 500);
        }
    }
    
    private function getDeliveries($filters = []) {
        $status = $filters['status'] ?? null;
        $search = $filters['search'] ?? '';
        
        $cacheKey = "deliveries_{$status}_{$search}";
        $cached = $this->getCache($cacheKey, 60);
        
        if ($cached) {
            $this->sendResponse($cached);
        }
        
        $sql = "SELECT * FROM warehouse_deliveries WHERE 1=1";
        $params = [];
        
        if ($status && $status !== 'all') {
            $sql .= " AND status = ?";
            $params[] = strtoupper($status);
        }
        
        if ($search) {
            $sql .= " AND (delivery_id ILIKE ? OR product_type ILIKE ? OR driver_name ILIKE ?)";
            $searchTerm = "%$search%";
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }
        
        $sql .= " ORDER BY created_at DESC";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $deliveries = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $this->setCache($cacheKey, $deliveries);
        $this->sendResponse($deliveries);
    }
    
    private function getPendingDeliveries() {
        $cacheKey = "pending_deliveries";
        $cached = $this->getCache($cacheKey, 30);
        
        if ($cached) {
            $this->sendResponse($cached);
        }
        
        $sql = "SELECT * FROM warehouse_deliveries WHERE status = 'PENDING' ORDER BY scheduled_date ASC";
        $stmt = $this->pdo->query($sql);
        $deliveries = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $this->setCache($cacheKey, $deliveries);
        $this->sendResponse($deliveries);
    }
    
    private function scanDelivery($data) {
        if (!$data || !isset($data['qr_data'])) {
            $this->sendResponse(['error' => 'QR data required'], 400);
        }
        
        $qrData = $data['qr_data'];
        $deliveryData = json_decode($qrData, true);
        
        if (!$deliveryData || !isset($deliveryData['deliveryId'])) {
            $this->sendResponse(['error' => 'Invalid QR code format'], 400);
        }
        
        $sql = "SELECT * FROM warehouse_deliveries WHERE delivery_id = ? AND status = 'PENDING'";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$deliveryData['deliveryId']]);
        $delivery = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$delivery) {
            $this->sendResponse(['error' => 'Delivery not found or already processed'], 404);
        }
        
        $this->sendResponse([
            'success' => true,
            'delivery' => $delivery,
            'qr_data' => $deliveryData
        ]);
    }
    
    private function confirmDelivery($data) {
        if (!$data || !isset($data['delivery_id'])) {
            $this->sendResponse(['error' => 'Delivery ID required'], 400);
        }
        
        $deliveryId = $data['delivery_id'];
        $actualWeight = $data['actual_weight'] ?? null;
        
        try {
            $this->pdo->beginTransaction();
            
            // Update delivery status
            $sql = "UPDATE warehouse_deliveries SET status = 'COMPLETED', received_date = NOW() WHERE delivery_id = ?";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$deliveryId]);
            
            // Get delivery details for inventory
            $sql = "SELECT * FROM warehouse_deliveries WHERE delivery_id = ?";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([$deliveryId]);
            $delivery = $stmt->fetch(PDO::FETCH_ASSOC);
            
            if (!$delivery) {
                throw new Exception('Delivery not found after update');
            }
            
            // Add to inventory
            $sql = "INSERT INTO warehouse_inventory (harvest_id, batch_id, product_type, quantity_kg, warehouse_id, status) 
                    VALUES (?, ?, ?, ?, ?, 'IN_STOCK')";
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                $delivery['harvest_id'] ?? 'default_harvest_id',
                $delivery['delivery_id'],
                $delivery['product_type'],
                $actualWeight ?? $delivery['quantity_kg'],
                'WAREHOUSE_A'
            ]);
            
            // Log activity
            $this->logActivity(
                'DELIVERY_RECEIVED', 
                "Received {$delivery['quantity_kg']}kg of {$delivery['product_type']} from {$delivery['driver_name']}",
                $deliveryId
            );
            
            $this->pdo->commit();
            
            // Clear relevant caches
            $this->clearCache('deliveries');
            $this->clearCache('inventory');
            $this->clearCache('pending_deliveries');
            $this->clearCache('activity_logs');
            
            $this->sendResponse([
                'success' => true, 
                'message' => 'Delivery confirmed and added to inventory',
                'delivery_id' => $deliveryId
            ]);
            
        } catch (Exception $e) {
            $this->pdo->rollBack();
            $this->sendResponse(['error' => 'Failed to confirm delivery: ' . $e->getMessage()], 500);
        }
    }
    
    private function getInventory() {
        $cacheKey = "inventory";
        $cached = $this->getCache($cacheKey, 60);
        
        if ($cached) {
            $this->sendResponse($cached);
        }
        
        $sql = "SELECT * FROM warehouse_inventory ORDER BY received_date DESC";
        $stmt = $this->pdo->query($sql);
        $inventory = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $this->setCache($cacheKey, $inventory);
        $this->sendResponse($inventory);
    }
    
    private function getInspections($filters = []) {
        $status = $filters['status'] ?? null;
        $product = $filters['product'] ?? null;
        $startDate = $filters['start_date'] ?? null;
        $endDate = $filters['end_date'] ?? null;
        $search = $filters['search'] ?? '';
        
        $cacheKey = "inspections_{$status}_{$product}_{$startDate}_{$endDate}_{$search}";
        $cached = $this->getCache($cacheKey, 60);
        
        if ($cached) {
            $this->sendResponse($cached);
        }
        
        $sql = "SELECT * FROM warehouse_inspections WHERE 1=1";
        $params = [];
        
        if ($status && $status !== 'all') {
            $sql .= " AND status = ?";
            $params[] = strtoupper($status);
        }
        
        if ($product && $product !== 'all') {
            $sql .= " AND product_type = ?";
            $params[] = $product;
        }
        
        if ($startDate) {
            $sql .= " AND DATE(inspection_date) >= ?";
            $params[] = $startDate;
        }
        
        if ($endDate) {
            $sql .= " AND DATE(inspection_date) <= ?";
            $params[] = $endDate;
        }
        
        if ($search) {
            $sql .= " AND (inspection_id ILIKE ? OR batch_id ILIKE ? OR product_type ILIKE ?)";
            $searchTerm = "%$search%";
            $params[] = $searchTerm;
            $params[] = $searchTerm;
            $params[] = $searchTerm;
        }
        
        $sql .= " ORDER BY inspection_date DESC LIMIT 100";
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute($params);
        $inspections = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $this->setCache($cacheKey, $inspections);
        $this->sendResponse($inspections);
    }
    
    private function createInspection($data) {
        $required = ['batch_id', 'product_type', 'expected_weight', 'actual_weight', 'status'];
        foreach ($required as $field) {
            if (empty($data[$field])) {
                $this->sendResponse(['error' => "Missing required field: $field"], 400);
            }
        }
        
        try {
            $inspectionId = 'INS-' . date('Ymd-His') . '-' . rand(100, 999);
            $variance = (($data['actual_weight'] - $data['expected_weight']) / $data['expected_weight']) * 100;
            
            $sql = "INSERT INTO warehouse_inspections 
                    (inspection_id, harvest_id, batch_id, product_type, expected_weight_kg, actual_weight_kg, 
                     weight_variance_percent, status, inspector_name, moisture_content, purity_level, 
                     foreign_matter, overall_quality, notes) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)";
            
            $stmt = $this->pdo->prepare($sql);
            $stmt->execute([
                $inspectionId,
                $data['harvest_id'] ?? null,
                $data['batch_id'],
                $data['product_type'],
                $data['expected_weight'],
                $data['actual_weight'],
                round($variance, 2),
                strtoupper($data['status']),
                $data['inspector_name'] ?? 'Warehouse A Inspector',
                $data['moisture_content'] ?? null,
                $data['purity_level'] ?? null,
                $data['foreign_matter'] ?? null,
                $data['overall_quality'] ?? null,
                $data['notes'] ?? null
            ]);
            
            // Log activity
            $this->logActivity(
                'INSPECTION_COMPLETED', 
                "Inspected {$data['product_type']} batch {$data['batch_id']} - Status: " . strtoupper($data['status']),
                $inspectionId
            );
            
            // Clear caches
            $this->clearCache('inspections');
            $this->clearCache('reports');
            $this->clearCache('activity_logs');
            
            $this->sendResponse([
                'success' => true, 
                'inspection_id' => $inspectionId,
                'variance' => round($variance, 2)
            ]);
            
        } catch (Exception $e) {
            $this->sendResponse(['error' => 'Failed to create inspection: ' . $e->getMessage()], 500);
        }
    }
    
    private function getInspectionHistory() {
        $cacheKey = "inspection_history";
        $cached = $this->getCache($cacheKey, 120);
        
        if ($cached) {
            $this->sendResponse($cached);
        }
        
        $sql = "SELECT * FROM warehouse_inspections ORDER BY inspection_date DESC LIMIT 200";
        $stmt = $this->pdo->query($sql);
        $inspections = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $this->setCache($cacheKey, $inspections);
        $this->sendResponse($inspections);
    }
    
    private function getReportsStats($filters = []) {
        $period = $filters['period'] ?? '30d';
        $cacheKey = "reports_stats_{$period}";
        $cached = $this->getCache($cacheKey, 300);
        
        if ($cached) {
            $this->sendResponse($cached);
        }
        
        // Calculate date range based on period
        $endDate = date('Y-m-d');
        switch ($period) {
            case '7d': 
                $startDate = date('Y-m-d', strtotime('-7 days')); 
                break;
            case '90d': 
                $startDate = date('Y-m-d', strtotime('-90 days')); 
                break;
            case 'ytd': 
                $startDate = date('Y-01-01'); 
                break;
            default: 
                $startDate = date('Y-m-d', strtotime('-30 days'));
        }
        
        // Total inspections
        $sql = "SELECT COUNT(*) as total FROM warehouse_inspections WHERE DATE(inspection_date) BETWEEN ? AND ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$startDate, $endDate]);
        $total = $stmt->fetch(PDO::FETCH_ASSOC)['total'];
        
        // Approved inspections
        $sql = "SELECT COUNT(*) as approved FROM warehouse_inspections WHERE status = 'APPROVED' AND DATE(inspection_date) BETWEEN ? AND ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$startDate, $endDate]);
        $approved = $stmt->fetch(PDO::FETCH_ASSOC)['approved'];
        
        // Conditional inspections
        $sql = "SELECT COUNT(*) as conditional FROM warehouse_inspections WHERE status = 'CONDITIONAL' AND DATE(inspection_date) BETWEEN ? AND ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$startDate, $endDate]);
        $conditional = $stmt->fetch(PDO::FETCH_ASSOC)['conditional'];
        
        // Average weight variance
        $sql = "SELECT AVG(ABS(weight_variance_percent)) as avg_variance FROM warehouse_inspections WHERE DATE(inspection_date) BETWEEN ? AND ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$startDate, $endDate]);
        $avgVariance = $stmt->fetch(PDO::FETCH_ASSOC)['avg_variance'];
        
        $stats = [
            'total_inspections' => (int)$total,
            'approved' => (int)$approved,
            'conditional' => (int)$conditional,
            'rejected' => (int)$total - $approved - $conditional,
            'approval_rate' => $total > 0 ? round(($approved / $total) * 100, 1) : 0,
            'avg_weight_variance' => round($avgVariance ?: 0, 1),
            'period' => $period,
            'date_range' => ['start' => $startDate, 'end' => $endDate]
        ];
        
        $this->setCache($cacheKey, $stats);
        $this->sendResponse($stats);
    }
    
    private function getActivityLogs($filters = []) {
        $limit = $filters['limit'] ?? 20;
        $cacheKey = "activity_logs_{$limit}";
        $cached = $this->getCache($cacheKey, 30);
        
        if ($cached) {
            $this->sendResponse($cached);
        }
        
        $sql = "SELECT * FROM warehouse_activity_logs ORDER BY timestamp DESC LIMIT ?";
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([$limit]);
        $logs = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        $this->setCache($cacheKey, $logs);
        $this->sendResponse($logs);
    }
    
    private function logActivity($actionType, $details, $referenceId = null) {
        $sql = "INSERT INTO warehouse_activity_logs (warehouse_id, action_type, details, delivery_id, inspection_id, user_id) 
                VALUES (?, ?, ?, ?, ?, ?)";
        
        $deliveryId = strpos($actionType, 'DELIVERY') !== false ? $referenceId : null;
        $inspectionId = strpos($actionType, 'INSPECTION') !== false ? $referenceId : null;
        
        $stmt = $this->pdo->prepare($sql);
        $stmt->execute([
            'WAREHOUSE_A',
            $actionType,
            $details,
            $deliveryId,
            $inspectionId,
            'WA-001'
        ]);
        
        $this->clearCache('activity_logs');
    }
    
    private function exportPdf($data) {
        // Simple PDF generation - in production, use TCPDF or Dompdf
        $inspections = $this->getInspections($data);
        
        $pdfContent = "
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; }
                    h1 { color: #2E7D32; }
                    table { width: 100%; border-collapse: collapse; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                </style>
            </head>
            <body>
                <h1>Warehouse Inspection Report</h1>
                <p>Generated on: " . date('Y-m-d H:i:s') . "</p>
                <table>
                    <tr>
                        <th>Batch ID</th>
                        <th>Product</th>
                        <th>Status</th>
                        <th>Expected Weight</th>
                        <th>Actual Weight</th>
                        <th>Variance</th>
                        <th>Date</th>
                    </tr>";
        
        foreach ($inspections as $inspection) {
            $pdfContent .= "
                    <tr>
                        <td>{$inspection['batch_id']}</td>
                        <td>{$inspection['product_type']}</td>
                        <td>{$inspection['status']}</td>
                        <td>{$inspection['expected_weight_kg']} kg</td>
                        <td>{$inspection['actual_weight_kg']} kg</td>
                        <td>{$inspection['weight_variance_percent']}%</td>
                        <td>" . date('Y-m-d', strtotime($inspection['inspection_date'])) . "</td>
                    </tr>";
        }
        
        $pdfContent .= "
                </table>
            </body>
            </html>";
        
        // For now, we'll return HTML that can be printed as PDF
        // In production, use: TCPDF, DomPDF, or mpdf to generate actual PDF
        header('Content-Type: application/pdf');
        header('Content-Disposition: attachment; filename="inspections_report.pdf"');
        
        // Return JSON with HTML content that frontend can use to generate PDF
        $this->sendResponse([
            'success' => true,
            'html_content' => $pdfContent,
            'filename' => 'inspections_report_' . date('Y-m-d') . '.pdf',
            'message' => 'PDF content generated successfully. Use a PDF library on frontend or server to convert to PDF.'
        ]);
    }
    
    private function exportExcel($data) {
        $inspections = $this->getInspections($data);
        
        // Generate CSV content (Excel can open CSV)
        $csvContent = "Batch ID,Product,Status,Expected Weight,Actual Weight,Variance,Inspection Date,Inspector\n";
        
        foreach ($inspections as $inspection) {
            $csvContent .= "\"{$inspection['batch_id']}\",";
            $csvContent .= "\"{$inspection['product_type']}\",";
            $csvContent .= "\"{$inspection['status']}\",";
            $csvContent .= "\"{$inspection['expected_weight_kg']}\",";
            $csvContent .= "\"{$inspection['actual_weight_kg']}\",";
            $csvContent .= "\"{$inspection['weight_variance_percent']}\",";
            $csvContent .= "\"" . date('Y-m-d', strtotime($inspection['inspection_date'])) . "\",";
            $csvContent .= "\"" . ($inspection['inspector_name'] ?? 'N/A') . "\"\n";
        }
        
        header('Content-Type: text/csv');
        header('Content-Disposition: attachment; filename="inspections_export_' . date('Y-m-d') . '.csv"');
        echo $csvContent;
        exit;
    }
    
    private function exportCsv($data) {
        // Same as Excel for now, since CSV is universal
        $this->exportExcel($data);
    }
    
    private function checkSystemHealth() {
        try {
            // Test database connection
            $stmt = $this->pdo->query("SELECT NOW() as db_time, version() as db_version");
            $dbInfo = $stmt->fetch(PDO::FETCH_ASSOC);
            
            $this->sendResponse([
                'status' => 'healthy',
                'database' => [
                    'connected' => true,
                    'time' => $dbInfo['db_time'],
                    'version' => $dbInfo['db_version']
                ],
                'timestamp' => date('c')
            ]);
        } catch (Exception $e) {
            $this->sendResponse([
                'status' => 'unhealthy',
                'error' => $e->getMessage(),
                'timestamp' => date('c')
            ], 500);
        }
    }
}

// Initialize and handle the request
try {
    $backend = new WarehouseBackend();
    $backend->handleRequest();
} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => 'Server initialization error: ' . $e->getMessage()]);
}
