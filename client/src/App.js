import React, { useEffect, useState } from 'react';
import io from 'socket.io-client';

import "./App.css"

const socket = io.connect('http://localhost:4000');


function Pilot(data, idx) {
  return (
    <p key={idx}>{data.firstName} {data.lastName}  {data.email} {data.phoneNumber} | Distance: {(data.distance / 1000).toFixed(2)}m, updated at: { data.lastSeen}</p>
  );
}


function App() {
  const [data, setData] = useState([]);


  useEffect(() => {
    socket.on('update', (res) => {
      setData(JSON.parse(res));
    });
  }, [data, socket]);

  return (
    <div className="App">
      <header className="App-header">
        NDZ violaters list
      </header>
      <div className='App-list'>
      {data.length>0 ?
        data.map((pilot, idx) => {
          return (
            Pilot(pilot, idx)
          );
        })
        : <h2>List is empty</h2> 
      }
      </div>
      <footer><b>Made by <a href='https://www.linkedin.com/in/aleksandr-politov-a32527217/'>Aleksandr Politov</a> for Reaktor pre-assignment.</b></footer>
    </div>
  );
}

export default App;
