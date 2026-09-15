const express = require('express');
const app = express();
const port = process.env.PORT || 3000;

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const homeHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>TestCo1</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: #ffffff;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      width: 100vw;
    }
    form {
      display: flex;
      gap: 8px;
    }
    input[type="password"] {
      padding: 6px 10px;
      font-size: 14px;
      font-family: inherit;
    }
    button {
      padding: 6px 12px;
      font-size: 14px;
      font-family: inherit;
      cursor: pointer;
    }
  </style>
</head>
<body>
  <form id="passwordForm" method="POST" action="/">
    <input type="password" id="password" name="password" autofocus />
    <button type="submit">Enter</button>
  </form>
  <script>
    document.getElementById('passwordForm').addEventListener('submit', function(e) {
      e.preventDefault();
      const pwd = document.getElementById('password').value;
      if (pwd === 'test123') {
        window.location.href = '/success';
      } else {
        document.getElementById('password').value = '';
      }
    });
  </script>
</body>
</html>`;

const successHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Success</title>
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background-color: #ffffff;
      font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
      width: 100vw;
    }
    .success-text {
      font-weight: bold;
      font-size: 16px;
    }
  </style>
</head>
<body>
  <div class="success-text">success</div>
</body>
</html>`;

app.get('/', (req, res) => {
  res.send(homeHtml);
});

app.post('/', (req, res) => {
  const { password } = req.body;
  if (password === 'test123') {
    return res.redirect('/success');
  }
  res.send(homeHtml);
});

app.get('/success', (req, res) => {
  res.send(successHtml);
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
