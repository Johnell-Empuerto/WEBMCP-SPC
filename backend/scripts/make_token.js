const jwt = require('jsonwebtoken');
const payload = { userCode: '00000', userName: 'KD-1 TRIAL', roleId: 1, roleName: 'Super Admin' };
const token = jwt.sign(payload, 'nxpert-eon-jwt-secret-key-2024', { expiresIn: 28800 });
console.log(token);
