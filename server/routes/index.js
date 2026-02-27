const express = require("express");
const fs = require("fs");
const { PrismaClient } = require("../generated/prisma");
const multer = require("multer");
const { isValidDateStr, parseDateStr } = require("../utils/dateUtils");

const router = express.Router();

const prisma = new PrismaClient();
const upload = multer({ dest: "uploads/" });

router.get("/", (req, res) =>
  res.json({
    status: 200,
    message: "Welcome to this route",
  })
);

// load data
router.post("/load-data", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file uploaded" });

    const content = fs.readFileSync(req.file.path, "utf8");
    const lines = content.split(/\r?\n/);

    const readingsToInsert = [];

    lines.forEach((line) => {
      const tokens = line.trim().split(/\s+/);
      if (!tokens.length) return;

      let currentDate = null;

      for (let i = 0; i < tokens.length; i++) {
        const token = tokens[i];

        if (token === "-999") break;

        if (/^\d{8}$/.test(token)) {
          if (isValidDateStr(token)) {
            currentDate = parseDateStr(token);
          } else {
            currentDate = null;
          }
        } else if (currentDate) {
          const val = parseFloat(token);
          if (!isNaN(val) && val > 0 && val < 1000) {
            readingsToInsert.push({
              date: currentDate,
              frequency: val,
            });
          }
        }
      }
    });

    await prisma.seismicReading.createMany({
      data: readingsToInsert,
    });

    fs.unlinkSync(req.file.path);

    res.json({
      message: "Data processed successfully",
      count: readingsToInsert.length,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// fetch all data
router.get("/stats/daily", async (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;
  const skip = (page - 1) * limit;

  try {
    const readings = await prisma.seismicReading.findMany({
      orderBy: { date: "desc" },
      skip,
      take: limit,
    });

    const formatted = readings.map((r) => ({
      date: r.date.toISOString().split("T")[0],
      min: r.frequency,
      max: r.frequency,
      count: 1,
    }));

    const total = await prisma.seismicReading.count();

    res.json({
      data: formatted,
      meta: {
        total,
        page,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: e.message });
  }
});

// 2. Stats by Month, e.g: /stats/month/2023/10
router.get("/stats/month/:year/:month", async (req, res) => {
  const { year, month } = req.params;

  const startDate = new Date(`${year}-${month}-01`);
  const endDate = new Date(
    new Date(startDate).setMonth(startDate.getMonth() + 1)
  );

  try {
    const aggregations = await prisma.seismicReading.aggregate({
      _max: { frequency: true },
      _min: { frequency: true },
      _count: { frequency: true },
      where: {
        date: {
          gte: startDate,
          lt: endDate,
        },
      },
    });

    res.json({
      period: `${year}-${month}`,
      max: aggregations._max.frequency,
      min: aggregations._min.frequency,
      count: aggregations._count.frequency,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Stats by Day, e.g:/stats/day/2023/10/01
router.get("/stats/day/:year/:month/:day", async (req, res) => {
  const { year, month, day } = req.params;
  const targetDate = new Date(`${year}-${month}-${day}`);

  try {
    const aggregations = await prisma.seismicReading.aggregate({
      _max: { frequency: true },
      _min: { frequency: true },
      _count: { frequency: true },
      where: {
        date: {
          equals: targetDate,
        },
      },
    });

    res.json({
      period: `${year}-${month}-${day}`,
      max: aggregations._max.frequency,
      min: aggregations._min.frequency,
      count: aggregations._count.frequency,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
