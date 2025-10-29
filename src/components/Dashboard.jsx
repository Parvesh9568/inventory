const Dashboard = ({ inItems, outItems }) => {
  // Calculate weight totals
  const totalInWeight = inItems.reduce((sum, item) => sum + (item.qty || 0), 0);
  const totalOutWeight = outItems.reduce((sum, item) => sum + (item.qty || 0), 0);
  const netWeight = totalOutWeight - totalInWeight;

  // Calculate amount totals
  const totalInAmount = inItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalOutAmount = outItems.reduce((sum, item) => sum + (item.total || 0), 0);

  // Calculate per-vendor transaction totals
  const vendorTotals = {};
  
  // Process IN transactions
  inItems.forEach(item => {
    const vendor = item.vendor || 'Unknown';
    if (!vendorTotals[vendor]) {
      vendorTotals[vendor] = { vendor, totalIn: 0, totalOut: 0, balance: 0 };
    }
    vendorTotals[vendor].totalIn += (item.qty || 0);
  });

  // Process OUT transactions
  outItems.forEach(item => {
    const vendor = item.vendor || 'Unknown';
    if (!vendorTotals[vendor]) {
      vendorTotals[vendor] = { vendor, totalIn: 0, totalOut: 0, balance: 0 };
    }
    vendorTotals[vendor].totalOut += (item.qty || 0);
  });

  // Calculate balance for each vendor
  Object.values(vendorTotals).forEach(vendor => {
    vendor.balance = vendor.totalOut - vendor.totalIn;
  });

  // Convert to array and sort by vendor name
  const vendorTotalsArray = Object.values(vendorTotals).sort((a, b) => 
    a.vendor.localeCompare(b.vendor)
  );

  return (
    <div className="dashboard">
      <h2>📊 Dashboard Overview</h2>
      
      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card in-card">
          <h3>📥 Total IN Weight</h3>
          <p className="amount">{totalInWeight.toFixed(3)} kg</p>
        </div>
        
        <div className="summary-card out-card">
          <h3>📤 Total OUT Weight</h3>
          <p className="amount">{totalOutWeight.toFixed(3)} kg</p>
        </div>
        
        <div className="summary-card final-card">
          <h3>⚖️ Net Total Weight</h3>
          <p className="amount">{netWeight.toFixed(3)} kg</p>
          <span className="status">{netWeight >= 0 ? 'Available' : 'Deficit'}</span>
          <small style={{ display: 'block', marginTop: '8px', color: '#666' }}>
            Remaining inventory
          </small>
        </div>
      </div>

      {/* Per-Vendor Transaction Totals Table */}
      <div className="recent-activity" style={{ marginTop: '30px' }}>
        <h3>👥 Vendor-wise Transaction Summary</h3>
        {vendorTotalsArray.length > 0 ? (
          <table className="recent-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#667eea', color: 'white' }}>
                <th style={{ padding: '12px', textAlign: 'left', borderBottom: '2px solid #ddd' }}>Vendor</th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Total IN (kg)</th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Total OUT (kg)</th>
                <th style={{ padding: '12px', textAlign: 'right', borderBottom: '2px solid #ddd' }}>Balance (kg)</th>
              </tr>
            </thead>
            <tbody>
              {vendorTotalsArray.map((vendor, i) => (
                <tr key={i} style={{ 
                  backgroundColor: i % 2 === 0 ? '#f8f9fa' : 'white',
                  transition: 'background-color 0.2s'
                }}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#e8f4f8'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = i % 2 === 0 ? '#f8f9fa' : 'white'}
                >
                  <td style={{ padding: '12px', borderBottom: '1px solid #ddd', fontWeight: '600', color: '#2c3e50' }}>
                    {vendor.vendor}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #ddd', color: '#27ae60', fontWeight: '500' }}>
                    {vendor.totalIn.toFixed(3)}
                  </td>
                  <td style={{ padding: '12px', textAlign: 'right', borderBottom: '1px solid #ddd', color: '#e74c3c', fontWeight: '500' }}>
                    {vendor.totalOut.toFixed(3)}
                  </td>
                  <td style={{ 
                    padding: '12px', 
                    textAlign: 'right', 
                    borderBottom: '1px solid #ddd',
                    fontWeight: '700',
                    color: vendor.balance >= 0 ? '#27ae60' : '#e74c3c'
                  }}>
                    {vendor.balance.toFixed(3)}
                  </td>
                </tr>
              ))}
              {/* Total Row */}
              <tr style={{ backgroundColor: '#667eea', color: 'white', fontWeight: '700' }}>
                <td style={{ padding: '12px', borderTop: '2px solid #2c3e50' }}>
                  TOTAL
                </td>
                <td style={{ padding: '12px', textAlign: 'right', borderTop: '2px solid #2c3e50' }}>
                  {totalInWeight.toFixed(3)}
                </td>
                <td style={{ padding: '12px', textAlign: 'right', borderTop: '2px solid #2c3e50' }}>
                  {totalOutWeight.toFixed(3)}
                </td>
                <td style={{ padding: '12px', textAlign: 'right', borderTop: '2px solid #2c3e50' }}>
                  {netWeight.toFixed(3)}
                </td>
              </tr>
            </tbody>
          </table>
        ) : (
          <p className="no-data">No vendor data available.</p>
        )}
      </div>
     </div>
  );
};

export default Dashboard;
