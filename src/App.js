import './App.css';
import Page from './page'
import {Helmet} from 'react-helmet';

function App() {
  return (
    <div className="App">
      <Helmet>
        <meta name="theme-color" content="#282c34" />
        <style>{'body { background-color: #282c34; }'}</style>
      </Helmet>
      <div className="App-body">
        <Page />
      </div>
    </div>
  );
}

export default App;
