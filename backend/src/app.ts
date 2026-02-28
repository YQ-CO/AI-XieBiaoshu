import express from 'express';
import cors from 'cors';

import authRouter from './routes/auth';
import usersRouter from './routes/users';
import enterpriseRouter from './routes/enterprise';
import ordersRouter from './routes/orders';
import parseRouter from './routes/parse';
import documentsRouter from './routes/documents';
import modelRouter from './routes/model';
import adminRouter from './routes/admin';

const app = express();
app.use(cors());
app.use(express.json());

app.use('/auth', authRouter);
app.use('/users', usersRouter);
app.use('/enterprise', enterpriseRouter);
app.use('/orders', ordersRouter);
app.use('/parse', parseRouter);
app.use('/documents', documentsRouter);
app.use('/model', modelRouter);
app.use('/admin', adminRouter);

app.get('/', (req, res) => res.json({ status: 'ok', service: 'bid-platform-backend' }));

export default app;
