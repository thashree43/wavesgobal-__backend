import PropertyModel from "../Models/PropertyModel.js";
import UserModel from "../Models/UserModel.js";
import BookingModel from "../Models/BookingModel.js";
import locationmodel from "../Models/LocationModel.js";

// Get dashboard statistics and analytics
export const getDashboardStats = async (req, res) => {
  try {
    // Get current date and date ranges
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    // Basic counts
    const totalUsers = await UserModel.countDocuments();
    const totalProperties = await PropertyModel.countDocuments();
    const totalBookings = await BookingModel.countDocuments();
    const activeUsers = await UserModel.countDocuments({ status: 'active' });

    // Revenue calculation
    const revenueResult = await BookingModel.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, totalRevenue: { $sum: "$amount" } } }
    ]);
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;

    // Booking status counts
    const pendingBookings = await BookingModel.countDocuments({ status: 'pending' });
    const completedBookings = await BookingModel.countDocuments({ status: 'completed' });

    // Monthly growth calculation
    const currentMonthUsers = await UserModel.countDocuments({
      createdAt: { $gte: startOfMonth }
    });
    const lastMonthUsers = await UserModel.countDocuments({
      createdAt: { $gte: startOfLastMonth, $lt: startOfMonth }
    });
    
    const monthlyGrowth = lastMonthUsers > 0 
      ? ((currentMonthUsers - lastMonthUsers) / lastMonthUsers) * 100 
      : 0;

    res.status(200).json({
      success: true,
      stats: {
        totalUsers,
        totalProperties,
        totalBookings,
        totalRevenue,
        activeUsers,
        pendingBookings,
        completedBookings,
        monthlyGrowth: Math.round(monthlyGrowth * 100) / 100
      }
    });

  } catch (error) {
    console.error("Error getting dashboard stats:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get monthly revenue and booking data
export const getMonthlyRevenue = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    
    const monthlyData = await BookingModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(currentYear, 0, 1),
            $lte: new Date(currentYear, 11, 31, 23, 59, 59)
          },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          revenue: { $sum: "$amount" },
          bookings: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // Create array with all months, filling missing months with 0
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    const formattedData = months.map((month, index) => {
      const monthData = monthlyData.find(data => data._id === index + 1);
      return {
        month,
        revenue: monthData ? monthData.revenue : 0,
        bookings: monthData ? monthData.bookings : 0
      };
    });

    res.status(200).json({
      success: true,
      monthlyRevenue: formattedData
    });

  } catch (error) {
    console.error("Error getting monthly revenue:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get user growth data
export const getUserGrowth = async (req, res) => {
  try {
    const currentYear = new Date().getFullYear();
    
    const userGrowthData = await UserModel.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(currentYear, 0, 1),
            $lte: new Date(currentYear, 11, 31, 23, 59, 59)
          }
        }
      },
      {
        $group: {
          _id: { $month: "$createdAt" },
          count: { $sum: 1 }
        }
      },
      { $sort: { "_id": 1 } }
    ]);

    // Calculate cumulative growth
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                   'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    
    let cumulativeUsers = 0;
    const formattedData = months.map((month, index) => {
      const monthData = userGrowthData.find(data => data._id === index + 1);
      cumulativeUsers += monthData ? monthData.count : 0;
      return {
        month,
        users: cumulativeUsers
      };
    });

    res.status(200).json({
      success: true,
      userGrowth: formattedData
    });

  } catch (error) {
    console.error("Error getting user growth:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get property type distribution
export const getPropertyTypes = async (req, res) => {
  try {
    const propertyTypes = await PropertyModel.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 }
        }
      }
    ]);

    // Define colors for different property types
    const colorMap = {
      'apartment': '#3B82F6',
      'house': '#10B981',
      'villa': '#F59E0B',
      'condo': '#EF4444',
      'studio': '#8B5CF6',
      'penthouse': '#F97316'
    };

    const formattedData = propertyTypes.map(type => ({
      name: type._id ? type._id.charAt(0).toUpperCase() + type._id.slice(1) : 'Other',
      value: type.count,
      color: colorMap[type._id?.toLowerCase()] || '#6B7280'
    }));

    res.status(200).json({
      success: true,
      propertyTypes: formattedData
    });

  } catch (error) {
    console.error("Error getting property types:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get booking status distribution
export const getBookingStatus = async (req, res) => {
  try {
    const bookingStatus = await BookingModel.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    const colorMap = {
      'completed': '#10B981',
      'pending': '#F59E0B',
      'cancelled': '#EF4444',
      'confirmed': '#3B82F6'
    };

    const formattedData = bookingStatus.map(status => ({
      name: status._id ? status._id.charAt(0).toUpperCase() + status._id.slice(1) : 'Unknown',
      value: status.count,
      color: colorMap[status._id?.toLowerCase()] || '#6B7280'
    }));

    res.status(200).json({
      success: true,
      bookingStatus: formattedData
    });

  } catch (error) {
    console.error("Error getting booking status:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get recent bookings
export const getRecentBookings = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 5;
    
    const recentBookings = await BookingModel
      .find()
      .populate('userId', 'name email')
      .populate('propertyId', 'title')
      .sort({ createdAt: -1 })
      .limit(limit);

    const formattedBookings = recentBookings.map(booking => ({
      id: booking._id,
      user: booking.userId?.name || 'Unknown User',
      property: booking.propertyId?.title || 'Unknown Property',
      checkIn: booking.checkInDate ? new Date(booking.checkInDate).toISOString().split('T')[0] : '',
      checkOut: booking.checkOutDate ? new Date(booking.checkOutDate).toISOString().split('T')[0] : '',
      amount: booking.amount || 0,
      status: booking.status || 'pending',
      createdAt: booking.createdAt
    }));

    res.status(200).json({
      success: true,
      recentBookings: formattedBookings
    });

  } catch (error) {
    console.error("Error getting recent bookings:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get top locations by bookings
export const getTopLocations = async (req, res) => {
  try {
    const topLocations = await BookingModel.aggregate([
      {
        $lookup: {
          from: 'properties',
          localField: 'propertyId',
          foreignField: '_id',
          as: 'property'
        }
      },
      { $unwind: '$property' },
      {
        $lookup: {
          from: 'locations',
          localField: 'property.neighborhood',
          foreignField: '_id',
          as: 'location'
        }
      },
      { $unwind: '$location' },
      {
        $group: {
          _id: '$location.name',
          bookings: { $sum: 1 },
          properties: { $addToSet: '$property._id' }
        }
      },
      {
        $project: {
          name: '$_id',
          bookings: 1,
          properties: { $size: '$properties' },
          _id: 0
        }
      },
      { $sort: { bookings: -1 } },
      { $limit: 5 }
    ]);

    res.status(200).json({
      success: true,
      topLocations
    });

  } catch (error) {
    console.error("Error getting top locations:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Get all dashboard data in one request
export const getDashboardData = async (req, res) => {
  try {
    // Get all dashboard data concurrently
    const [
      statsResult,
      monthlyRevenueResult,
      userGrowthResult,
      propertyTypesResult,
      bookingStatusResult,
      recentBookingsResult,
      topLocationsResult
    ] = await Promise.allSettled([
      getDashboardStatsData(),
      getMonthlyRevenueData(),
      getUserGrowthData(),
      getPropertyTypesData(),
      getBookingStatusData(),
      getRecentBookingsData(),
      getTopLocationsData()
    ]);

    const dashboardData = {
      stats: statsResult.status === 'fulfilled' ? statsResult.value : {},
      monthlyRevenue: monthlyRevenueResult.status === 'fulfilled' ? monthlyRevenueResult.value : [],
      userGrowth: userGrowthResult.status === 'fulfilled' ? userGrowthResult.value : [],
      propertyTypes: propertyTypesResult.status === 'fulfilled' ? propertyTypesResult.value : [],
      bookingStatus: bookingStatusResult.status === 'fulfilled' ? bookingStatusResult.value : [],
      recentBookings: recentBookingsResult.status === 'fulfilled' ? recentBookingsResult.value : [],
      topLocations: topLocationsResult.status === 'fulfilled' ? topLocationsResult.value : []
    };

    res.status(200).json({
      success: true,
      data: dashboardData
    });

  } catch (error) {
    console.error("Error getting dashboard data:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
};

// Helper functions for data aggregation
const getDashboardStatsData = async () => {
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  const [
    totalUsers,
    totalProperties,
    totalBookings,
    activeUsers,
    pendingBookings,
    completedBookings,
    revenueResult,
    currentMonthUsers,
    lastMonthUsers
  ] = await Promise.all([
    UserModel.countDocuments(),
    PropertyModel.countDocuments(),
    BookingModel.countDocuments(),
    UserModel.countDocuments({ status: 'active' }),
    BookingModel.countDocuments({ status: 'pending' }),
    BookingModel.countDocuments({ status: 'completed' }),
    BookingModel.aggregate([
      { $match: { status: 'completed' } },
      { $group: { _id: null, totalRevenue: { $sum: "$amount" } } }
    ]),
    UserModel.countDocuments({ createdAt: { $gte: startOfMonth } }),
    UserModel.countDocuments({ 
      createdAt: { $gte: startOfLastMonth, $lt: startOfMonth } 
    })
  ]);

  const totalRevenue = revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0;
  const monthlyGrowth = lastMonthUsers > 0 
    ? ((currentMonthUsers - lastMonthUsers) / lastMonthUsers) * 100 
    : 0;

  return {
    totalUsers,
    totalProperties,
    totalBookings,
    totalRevenue,
    activeUsers,
    pendingBookings,
    completedBookings,
    monthlyGrowth: Math.round(monthlyGrowth * 100) / 100
  };
};

const getMonthlyRevenueData = async () => {
  const currentYear = new Date().getFullYear();
  
  const monthlyData = await BookingModel.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(currentYear, 0, 1),
          $lte: new Date(currentYear, 11, 31, 23, 59, 59)
        },
        status: 'completed'
      }
    },
    {
      $group: {
        _id: { $month: "$createdAt" },
        revenue: { $sum: "$amount" },
        bookings: { $sum: 1 }
      }
    },
    { $sort: { "_id": 1 } }
  ]);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  return months.map((month, index) => {
    const monthData = monthlyData.find(data => data._id === index + 1);
    return {
      month,
      revenue: monthData ? monthData.revenue : 0,
      bookings: monthData ? monthData.bookings : 0
    };
  });
};

const getUserGrowthData = async () => {
  const currentYear = new Date().getFullYear();
  
  const userGrowthData = await UserModel.aggregate([
    {
      $match: {
        createdAt: {
          $gte: new Date(currentYear, 0, 1),
          $lte: new Date(currentYear, 11, 31, 23, 59, 59)
        }
      }
    },
    {
      $group: {
        _id: { $month: "$createdAt" },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id": 1 } }
  ]);

  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  
  let cumulativeUsers = 0;
  return months.map((month, index) => {
    const monthData = userGrowthData.find(data => data._id === index + 1);
    cumulativeUsers += monthData ? monthData.count : 0;
    return { month, users: cumulativeUsers };
  });
};

const getPropertyTypesData = async () => {
  const propertyTypes = await PropertyModel.aggregate([
    {
      $group: {
        _id: "$type",
        count: { $sum: 1 }
      }
    }
  ]);

  const colorMap = {
    'apartment': '#3B82F6',
    'house': '#10B981',
    'villa': '#F59E0B',
    'condo': '#EF4444',
    'studio': '#8B5CF6',
    'penthouse': '#F97316'
  };

  return propertyTypes.map(type => ({
    name: type._id ? type._id.charAt(0).toUpperCase() + type._id.slice(1) : 'Other',
    value: type.count,
    color: colorMap[type._id?.toLowerCase()] || '#6B7280'
  }));
};

const getBookingStatusData = async () => {
  const bookingStatus = await BookingModel.aggregate([
    {
      $group: {
        _id: "$status",
        count: { $sum: 1 }
      }
    }
  ]);

  const colorMap = {
    'completed': '#10B981',
    'pending': '#F59E0B',
    'cancelled': '#EF4444',
    'confirmed': '#3B82F6'
  };

  return bookingStatus.map(status => ({
    name: status._id ? status._id.charAt(0).toUpperCase() + status._id.slice(1) : 'Unknown',
    value: status.count,
    color: colorMap[status._id?.toLowerCase()] || '#6B7280'
  }));
};

const getRecentBookingsData = async () => {
  const recentBookings = await BookingModel
    .find()
    .populate('userId', 'name email')
    .populate('propertyId', 'title')
    .sort({ createdAt: -1 })
    .limit(5);

  return recentBookings.map(booking => ({
    id: booking._id,
    user: booking.userId?.name || 'Unknown User',
    property: booking.propertyId?.title || 'Unknown Property',
    checkIn: booking.checkInDate ? new Date(booking.checkInDate).toISOString().split('T')[0] : '',
    checkOut: booking.checkOutDate ? new Date(booking.checkOutDate).toISOString().split('T')[0] : '',
    amount: booking.amount || 0,
    status: booking.status || 'pending',
    createdAt: booking.createdAt
  }));
};

const getTopLocationsData = async () => {
  const topLocations = await BookingModel.aggregate([
    {
      $lookup: {
        from: 'properties',
        localField: 'propertyId',
        foreignField: '_id',
        as: 'property'
      }
    },
    { $unwind: '$property' },
    {
      $lookup: {
        from: 'locations',
        localField: 'property.neighborhood',
        foreignField: '_id',
        as: 'location'
      }
    },
    { $unwind: '$location' },
    {
      $group: {
        _id: '$location.name',
        bookings: { $sum: 1 },
        properties: { $addToSet: '$property._id' }
      }
    },
    {
      $project: {
        name: '$_id',
        bookings: 1,
        properties: { $size: '$properties' },
        _id: 0
      }
    },
    { $sort: { bookings: -1 } },
    { $limit: 5 }
  ]);

  return topLocations;
};