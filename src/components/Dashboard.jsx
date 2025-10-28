const Dashboard = ({ inItems, outItems }) => {
  // Calculate weight totals
  const totalInWeight = inItems.reduce((sum, item) => sum + (item.qty || 0), 0);
  const totalOutWeight = outItems.reduce((sum, item) => sum + (item.qty || 0), 0);
  const netWeight = totalOutWeight - totalInWeight;

  // Calculate amount totals
  const totalInAmount = inItems.reduce((sum, item) => sum + (item.total || 0), 0);
  const totalOutAmount = outItems.reduce((sum, item) => sum + (item.total || 0), 0);

  return (
    <div className="dashboard">
      <h2>📊 Dashboard Overview</h2>
      
      {/* Summary Cards */}
      <div className="summary-cards">
        <div className="summary-card in-card">
          <h3>📥 Total IN Weight</h3>
          <p className="amount">{totalInWeight.toFixed(3)} kg</p>
          {/* <span className="count">{inItems.length} transactions</span>
          <small style={{ display: 'block', marginTop: '8px', color: '#666' }}>
            Amount: ₹{totalInAmount.toFixed(2)}
          </small> */}
        </div>
        
        <div className="summary-card out-card">
          <h3>📤 Total OUT Weight</h3>
          <p className="amount">{totalOutWeight.toFixed(3)} kg</p>
          {/* <span className="count">{outItems.length} transactions</span>
          <small style={{ display: 'block', marginTop: '8px', color: '#666' }}>
            Amount: ₹{totalOutAmount.toFixed(2)}
          </small> */}
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

      {/* Recent Activity */}
      {/* <div className="recent-activity">
        <h3>📈 Recent Activity</h3>
        {recentItems.length > 0 ? (
          <table className="recent-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Vendor</th>
                <th>Item</th>
                <th>Qty</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              {recentItems.map((item, i) => (
                <tr key={i}>
                  <td>
                    <span className={`type-badge ${item.type.toLowerCase()}`}>
                      {item.type}
                    </span>
                  </td>
                  <td>{item.vendor}</td>
                  <td>{item.item}</td>
                  <td>{parseFloat(item.qty).toFixed(3)}</td>
                  <td>₹{item.total.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="no-data">No recent activity found.</p>
        )}
    </div> */}
     </div>
  );
};

export default Dashboard;
